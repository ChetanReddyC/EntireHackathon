import {
  ReviewResultSchema,
  type CheckpointEvidenceBundle,
  type ContextField,
  type EvidenceRetrieval,
  type ReviewResult,
} from "../shared/contracts.js";
import { createExternalEvidenceProjection } from "./privacy.js";

function describeGap(label: string, field: ContextField): string | undefined {
  if (field.availability === "available") {
    return undefined;
  }
  const state = field.availability === "redacted" ? "redacted" : "unavailable";
  return `${label} is ${state}${field.reason ? `: ${field.reason}` : "."}`;
}

export function buildLocalReview(
  bundle: CheckpointEvidenceBundle,
  retrieval?: EvidenceRetrieval,
): ReviewResult {
  const limitations = [
    describeGap("Original prompt", bundle.prompt),
    describeGap("Transcript", bundle.transcript),
    bundle.metadataPartial ? "Checkpoint metadata is partial." : undefined,
  ].filter((item): item is string => Boolean(item));

  const incomplete = limitations.length > 0;
  const externalProjection = createExternalEvidenceProjection(bundle);
  const fileEvidence = bundle.evidence.filter((item) => item.type === "file");
  const intent =
    bundle.prompt.availability === "available"
      ? bundle.prompt.value ?? "Original intent is available locally."
      : `Original intent ${bundle.prompt.availability}; do not infer it from the code changes.`;

  const result: ReviewResult = {
    checkpointId: bundle.checkpoint.id,
    contextCompleteness: incomplete ? "incomplete" : "complete",
    authority: incomplete ? "provisional" : "bounded",
    score: null,
    summary: incomplete
      ? `Provisional local review from ${fileEvidence.length} changed-file record${fileEvidence.length === 1 ? "" : "s"}. Missing context prevents an authoritative intent judgment.`
      : `Bounded local review from ${fileEvidence.length} changed-file record${fileEvidence.length === 1 ? "" : "s"}.`,
    limitations,
    signals: incomplete
      ? [
          {
            id: `${bundle.checkpoint.id}:context-gap`,
            status: "Risky",
            title: "Context gaps require verification",
            rationale:
              "Sensitive or missing Checkpoint fields prevent a complete comparison between implementation and original intent.",
            confidence: "limited",
            evidenceIds: fileEvidence.map((item) => item.id),
          },
        ]
      : [],
    evidence: bundle.evidence,
    retrieval: retrieval ?? {
      source: "local-fallback",
      status: "ready",
      evidenceIds: externalProjection.evidence.map((item) => item.id),
      notice: "Using canonical evidence from the local Checkpoint only.",
    },
    handoff: {
      originalIntent: intent,
      completedWork:
        bundle.outcome ??
        (fileEvidence.length > 0
          ? `${fileEvidence.length} changed file${fileEvidence.length === 1 ? " is" : "s are"} recorded in the Checkpoint.`
          : "No completed-work summary is available."),
      missingWork:
        bundle.openItems.length > 0
          ? bundle.openItems
          : incomplete
            ? ["Reconstruct the unavailable intent before deciding that the work is complete."]
            : [],
      risks: [
        ...bundle.friction,
        ...(incomplete
          ? ["This handoff is incomplete and must be verified against source code, tests, and an authorized context source."]
          : []),
      ],
      nextStep: incomplete
        ? "Verify the changed files and tests locally, then obtain authorized intent context before approving or continuing the change."
        : "Review the listed evidence locally before continuing the change.",
    },
    privacy: {
      processing: "local-only",
      externalEvidenceCount: externalProjection.evidence.length,
      sensitiveFieldsExcluded: ["prompt", "transcript"],
    },
  };

  return ReviewResultSchema.parse(result);
}
