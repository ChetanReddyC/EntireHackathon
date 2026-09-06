import type { CheckpointEvidenceBundle, Evidence } from "../shared/contracts.js";

export type ExternalEvidenceProjection = {
  checkpointId: string;
  evidence: Evidence[];
};

export function createExternalEvidenceProjection(
  bundle: CheckpointEvidenceBundle,
): ExternalEvidenceProjection {
  return {
    checkpointId: bundle.checkpoint.id,
    evidence: bundle.evidence.filter(
      (item) =>
        item.handling === "shareable" && item.type !== "prompt" && item.type !== "transcript",
    ),
  };
}
