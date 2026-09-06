import type {
  CheckpointEvidenceBundle,
  ContextField,
  Evidence,
  EvidenceRetrieval,
} from "../shared/contracts.js";
import { createExternalEvidenceProjection } from "./privacy.js";

export const ANALYSIS_PROMPT_VERSION = "checkpoint-intent-review-v2";

type ContextAvailability = ContextField["availability"];

export type AnalysisInput = {
  checkpoint: {
    id: string;
    title: string;
  };
  contextAvailability: {
    prompt: ContextAvailability;
    transcript: ContextAvailability;
    metadataPartial: boolean;
  };
  evidence: Evidence[];
};

export function buildAnalysisInput(
  bundle: CheckpointEvidenceBundle,
  retrieval: EvidenceRetrieval,
): AnalysisInput {
  const projection = createExternalEvidenceProjection(bundle);
  const retrievedIds = new Set(retrieval.evidenceIds);
  const retrievedEvidence = projection.evidence.filter((evidence) => retrievedIds.has(evidence.id));

  return {
    checkpoint: {
      id: bundle.checkpoint.id,
      title: bundle.checkpoint.title,
    },
    contextAvailability: {
      prompt: bundle.prompt.availability,
      transcript: bundle.transcript.availability,
      metadataPartial: bundle.metadataPartial,
    },
    evidence: retrievedEvidence.length > 0 ? retrievedEvidence : projection.evidence,
  };
}

export function buildAnalysisMessages(input: AnalysisInput) {
  return [
    {
      role: "system" as const,
      content: [
        "Review a software checkpoint using only the supplied allowlisted evidence.",
        "Never claim access to an original prompt, transcript, file body, test result, or requirement unless it appears in the supplied evidence.",
        "Return concise Done, Missing, Drifted, or Risky signals. Every non-Missing signal must cite at least one supplied evidence ID.",
        "Return exactly one valid JSON object with a summary string and signals array; do not wrap it in Markdown.",
        "Do not return a numeric score or handoff; deterministic application code owns those fields.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify(input),
    },
  ];
}
