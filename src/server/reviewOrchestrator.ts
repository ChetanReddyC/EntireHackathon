import { createHash } from "node:crypto";

import {
  ReviewResultSchema,
  type CheckpointEvidenceBundle,
  type EvidenceRetrieval,
  type IntentSignal,
  type PersistedReviewIdentity,
  type ReviewResult,
  type SemanticAnalysis,
} from "../shared/contracts.js";
import {
  ANALYSIS_PROMPT_VERSION,
  buildAnalysisInput,
} from "./analysisPrompt.js";
import {
  AnalysisUnavailableError,
  type AnalysisProvider,
} from "./analysisProvider.js";
import type { CheckpointSource } from "./checkpointSource.js";
import type { EvidenceRetriever } from "./evidenceRetriever.js";
import { validateAnalysisEvidence } from "./evidenceValidation.js";
import { buildLocalReview, hasIncompleteContext } from "./localReview.js";
import { createExternalEvidenceProjection } from "./privacy.js";
import type { ReviewStore } from "./reviewStore.js";
import { calculateIntentGuardScore } from "./scoring.js";

export const ANALYSIS_SCHEMA_VERSION = "review-result-v2";

type EnsureReviewOptions = {
  reanalyze?: boolean;
};

type ReviewDependencies = {
  checkpointSource: CheckpointSource;
  evidenceRetriever: EvidenceRetriever;
  analysisProvider: AnalysisProvider;
  reviewStore: ReviewStore;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildReviewIdentity(
  repositoryId: string,
  bundle: CheckpointEvidenceBundle,
  retrieval: EvidenceRetrieval,
  providerConfigurationId: string,
): PersistedReviewIdentity {
  const fingerprint = {
    checkpoint: bundle.checkpoint,
    prompt: {
      availability: bundle.prompt.availability,
      valueHash: digest(bundle.prompt.value ?? ""),
    },
    transcript: {
      availability: bundle.transcript.availability,
      valueHash: digest(bundle.transcript.value ?? ""),
    },
    metadataPartial: bundle.metadataPartial,
    evidence: [...bundle.evidence]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((evidence) => ({
        id: evidence.id,
        contentHash: evidence.contentHash,
        handling: evidence.handling,
        locator: evidence.provenance.locator,
      })),
    retrieval: {
      source: retrieval.source,
      status: retrieval.status,
      evidenceIds: [...retrieval.evidenceIds].sort(),
    },
  };

  return {
    repositoryId,
    checkpointId: bundle.checkpoint.id,
    evidenceHash: digest(JSON.stringify(fingerprint)),
    analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
    analysisPromptVersion: ANALYSIS_PROMPT_VERSION,
    providerConfigurationId,
  };
}

function buildHandoff(bundle: CheckpointEvidenceBundle, signals: IntentSignal[]) {
  const completed = signals.filter((signal) => signal.status === "Done");
  const missing = signals.filter(
    (signal) => signal.status === "Missing" || signal.status === "Drifted",
  );
  const risks = signals.filter(
    (signal) => signal.status === "Risky" || signal.status === "Drifted",
  );

  return {
    originalIntent: bundle.prompt.value ?? "Original intent is unavailable.",
    completedWork:
      bundle.outcome ??
      (completed.length > 0
        ? completed.map((signal) => signal.title).join("; ")
        : "No completed work was established by the validated analysis."),
    missingWork:
      missing.length > 0
        ? missing.map((signal) => `${signal.title}: ${signal.rationale}`)
        : bundle.openItems,
    risks: [
      ...bundle.friction,
      ...risks.map((signal) => `${signal.title}: ${signal.rationale}`),
    ],
    nextStep:
      missing[0]?.rationale ??
      risks[0]?.rationale ??
      "Verify the completed signals against their cited evidence before continuing.",
  };
}

function localRetrieval(bundle: CheckpointEvidenceBundle): EvidenceRetrieval {
  const projection = createExternalEvidenceProjection(bundle);
  return {
    source: "local-fallback",
    status: "ready",
    evidenceIds: projection.evidence.map((evidence) => evidence.id),
    notice: "Incomplete Checkpoint context remains local; using allowlisted local evidence only.",
  };
}

export async function ensureReview(
  repositoryId: string,
  checkpointId: string,
  dependencies: ReviewDependencies,
  options: EnsureReviewOptions = {},
): Promise<ReviewResult> {
  const bundle = await dependencies.checkpointSource.getCheckpointEvidence(checkpointId);
  if (hasIncompleteContext(bundle)) {
    return buildLocalReview(bundle, localRetrieval(bundle));
  }

  const retrieval = await dependencies.evidenceRetriever.retrieve(bundle);
  const input = buildAnalysisInput(bundle, retrieval);
  if (!dependencies.analysisProvider.available || input.evidence.length === 0) {
    const notice = input.evidence.length === 0
      ? "No evidence is authorized for semantic analysis; showing deterministic local evidence."
      : "No semantic analysis provider is configured; showing deterministic local evidence.";
    return buildLocalReview(bundle, retrieval, notice);
  }

  const identity = buildReviewIdentity(
    repositoryId,
    bundle,
    retrieval,
    dependencies.analysisProvider.configurationId,
  );
  let cacheReadFailure: string | undefined;

  if (!options.reanalyze) {
    try {
      const cached = await dependencies.reviewStore.read(identity);
      if (cached) {
        return ReviewResultSchema.parse({
          ...cached,
          analysis: {
            ...cached.analysis,
            cache: "hit",
            notice: "Loaded a validated review from the local filesystem cache.",
          },
        });
      }
    } catch (error) {
      cacheReadFailure = error instanceof Error ? error.message : "Unknown cache read failure.";
    }
  }

  let semanticAnalysis: SemanticAnalysis;
  try {
    semanticAnalysis = await dependencies.analysisProvider.analyze(input);
  } catch (error) {
    if (error instanceof AnalysisUnavailableError) {
      return buildLocalReview(
        bundle,
        retrieval,
        `${error.message} Showing deterministic local evidence instead.`,
      );
    }
    throw error;
  }

  const validated = validateAnalysisEvidence(semanticAnalysis, input.evidence);
  const base = buildLocalReview(bundle, retrieval);
  const cacheState = options.reanalyze ? "bypassed" : "miss";
  const result = ReviewResultSchema.parse({
    ...base,
    authority: "bounded",
    score: calculateIntentGuardScore(validated.signals),
    summary: validated.summary,
    signals: validated.signals,
    handoff: buildHandoff(bundle, validated.signals),
    analysis: {
      status: "complete",
      provider: dependencies.analysisProvider.kind,
      cache: cacheState,
      persistence: "stored",
      evidenceIds: input.evidence.map((evidence) => evidence.id),
      notice: cacheReadFailure
        ? `Analysis completed; the prior cache could not be read (${cacheReadFailure}). The new result was persisted locally.`
        : `${dependencies.analysisProvider.label} analysis completed from allowlisted evidence and was persisted locally.`,
    },
    privacy: {
      processing: "external-allowlisted",
      externalEvidenceCount: input.evidence.length,
      sensitiveFieldsExcluded: ["prompt", "transcript"],
    },
  });

  try {
    await dependencies.reviewStore.write(identity, result);
    return result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown persistence failure.";
    return ReviewResultSchema.parse({
      ...result,
      analysis: {
        ...result.analysis,
        persistence: "failed",
        notice: `Analysis completed, but local persistence failed: ${detail}`,
      },
    });
  }
}
