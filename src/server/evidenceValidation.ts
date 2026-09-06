import {
  SemanticAnalysisSchema,
  type Evidence,
  type SemanticAnalysis,
} from "../shared/contracts.js";

export function validateAnalysisEvidence(
  analysis: SemanticAnalysis,
  suppliedEvidence: Evidence[],
): SemanticAnalysis {
  const parsed = SemanticAnalysisSchema.parse(analysis);
  const suppliedIds = new Set(suppliedEvidence.map((evidence) => evidence.id));

  for (const signal of parsed.signals) {
    const unknownId = signal.evidenceIds.find((evidenceId) => !suppliedIds.has(evidenceId));
    if (unknownId) {
      throw new Error(`Semantic analysis referenced unknown evidence ID: ${unknownId}`);
    }
  }

  return parsed;
}
