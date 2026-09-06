import { z } from "zod";

export const RepositoryContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
});

export type RepositoryContext = z.infer<typeof RepositoryContextSchema>;

export const ContextAvailabilitySchema = z.enum(["available", "redacted", "unavailable"]);

export const ContextFieldSchema = z
  .object({
    availability: ContextAvailabilitySchema,
    value: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  })
  .superRefine((field, context) => {
    if (field.availability === "available" && !field.value) {
      context.addIssue({
        code: "custom",
        message: "Available context must include a value.",
        path: ["value"],
      });
    }
    if (field.availability !== "available" && field.value) {
      context.addIssue({
        code: "custom",
        message: "Redacted or unavailable context must not include a value.",
        path: ["value"],
      });
    }
  });

export type ContextField = z.infer<typeof ContextFieldSchema>;

export const ContextCompletenessSchema = z.enum(["complete", "incomplete", "unknown"]);

export const CheckpointSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  agent: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  contextCompleteness: ContextCompletenessSchema,
});

export type CheckpointSummary = z.infer<typeof CheckpointSummarySchema>;

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["file", "test", "prompt", "transcript", "checkpoint-summary"]),
  label: z.string().min(1),
  content: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: z.object({
    source: z.literal("entire-checkpoint"),
    checkpointId: z.string().min(1),
    locator: z.string().min(1),
  }),
  handling: z.enum(["shareable", "local-only"]),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const CheckpointEvidenceBundleSchema = z.object({
  checkpoint: CheckpointSummarySchema,
  prompt: ContextFieldSchema,
  transcript: ContextFieldSchema,
  metadataPartial: z.boolean(),
  outcome: z.string().min(1).optional(),
  openItems: z.array(z.string().min(1)).default([]),
  friction: z.array(z.string().min(1)).default([]),
  evidence: z.array(EvidenceSchema),
});

export type CheckpointEvidenceBundle = z.infer<typeof CheckpointEvidenceBundleSchema>;

export const IntentSignalSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["Done", "Missing", "Drifted", "Risky"]),
  title: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.enum(["supported", "limited"]),
  evidenceIds: z.array(z.string().min(1)),
});

export type IntentSignal = z.infer<typeof IntentSignalSchema>;

export const SemanticAnalysisSchema = z
  .object({
    summary: z.string().min(1),
    signals: z.array(IntentSignalSchema).max(20),
  })
  .superRefine((analysis, context) => {
    const signalIds = new Set<string>();
    analysis.signals.forEach((signal, index) => {
      if (signalIds.has(signal.id)) {
        context.addIssue({
          code: "custom",
          message: "Semantic analysis signal IDs must be unique.",
          path: ["signals", index, "id"],
        });
      }
      signalIds.add(signal.id);
      if (signal.status !== "Missing" && signal.evidenceIds.length === 0) {
        context.addIssue({
          code: "custom",
          message: `${signal.status} signals require at least one evidence reference.`,
          path: ["signals", index, "evidenceIds"],
        });
      }
    });
  });

export type SemanticAnalysis = z.infer<typeof SemanticAnalysisSchema>;

export const EvidenceRetrievalSchema = z.object({
  source: z.enum(["databricks", "local-fallback"]),
  status: z.enum(["ready", "unavailable"]),
  evidenceIds: z.array(z.string().min(1)),
  notice: z.string().min(1),
});

export type EvidenceRetrieval = z.infer<typeof EvidenceRetrievalSchema>;

export const ReviewResultSchema = z
  .object({
    checkpointId: z.string().min(1),
    contextCompleteness: z.enum(["complete", "incomplete"]),
    authority: z.enum(["bounded", "provisional"]),
    score: z.number().int().min(0).max(100).nullable(),
    summary: z.string().min(1),
    limitations: z.array(z.string().min(1)),
    signals: z.array(IntentSignalSchema),
    evidence: z.array(EvidenceSchema),
    retrieval: EvidenceRetrievalSchema,
    analysis: z.object({
      status: z.enum(["complete", "unavailable", "not-run"]),
      provider: z.enum(["agentrouter", "deepseek", "local"]),
      cache: z.enum(["hit", "miss", "bypassed"]),
      persistence: z.enum(["stored", "not-stored", "failed"]),
      evidenceIds: z.array(z.string().min(1)),
      notice: z.string().min(1),
    }),
    handoff: z.object({
      originalIntent: z.string().min(1),
      completedWork: z.string().min(1),
      missingWork: z.array(z.string().min(1)),
      risks: z.array(z.string().min(1)),
      nextStep: z.string().min(1),
    }),
    privacy: z.object({
      processing: z.enum(["local-only", "external-allowlisted"]),
      externalEvidenceCount: z.number().int().nonnegative(),
      sensitiveFieldsExcluded: z.array(z.enum(["prompt", "transcript"])),
    }),
  })
  .superRefine((result, context) => {
    const evidenceIds = new Set(result.evidence.map((evidence) => evidence.id));
    const analysisEvidenceIds = new Set(result.analysis.evidenceIds);
    result.signals.forEach((signal, signalIndex) => {
      signal.evidenceIds.forEach((evidenceId, evidenceIndex) => {
        if (!evidenceIds.has(evidenceId)) {
          context.addIssue({
            code: "custom",
            message: "Signals may reference only canonical evidence returned with the review.",
            path: ["signals", signalIndex, "evidenceIds", evidenceIndex],
          });
        }
        if (result.analysis.status === "complete" && !analysisEvidenceIds.has(evidenceId)) {
          context.addIssue({
            code: "custom",
            message: "Analyzed signals may reference only evidence supplied to the analysis provider.",
            path: ["signals", signalIndex, "evidenceIds", evidenceIndex],
          });
        }
      });
    });

    result.analysis.evidenceIds.forEach((evidenceId, index) => {
      const evidence = result.evidence.find((item) => item.id === evidenceId);
      if (
        !evidence ||
        evidence.handling !== "shareable" ||
        evidence.type === "prompt" ||
        evidence.type === "transcript"
      ) {
        context.addIssue({
          code: "custom",
          message: "Analysis evidence must resolve to allowlisted non-prompt/non-transcript evidence.",
          path: ["analysis", "evidenceIds", index],
        });
      }
    });

    if (result.contextCompleteness === "incomplete") {
      if (result.authority !== "provisional") {
        context.addIssue({
          code: "custom",
          message: "Incomplete context can only produce a provisional result.",
          path: ["authority"],
        });
      }
      if (result.score !== null) {
        context.addIssue({
          code: "custom",
          message: "Incomplete context cannot produce an Intent Guard score.",
          path: ["score"],
        });
      }
      if (result.analysis.status === "complete" || result.privacy.processing !== "local-only") {
        context.addIssue({
          code: "custom",
          message: "Incomplete context cannot be presented as externally analyzed.",
          path: ["analysis", "status"],
        });
      }
      if (result.analysis.evidenceIds.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Incomplete context cannot declare model-visible evidence.",
          path: ["analysis", "evidenceIds"],
        });
      }
    }

    if (result.analysis.status === "complete" && result.contextCompleteness !== "complete") {
      context.addIssue({
        code: "custom",
        message: "Completed semantic analysis requires complete Checkpoint context.",
        path: ["analysis", "status"],
      });
    }
    if (result.analysis.status === "complete" && result.privacy.processing !== "external-allowlisted") {
      context.addIssue({
        code: "custom",
        message: "Semantic analysis must disclose allowlisted external processing.",
        path: ["privacy", "processing"],
      });
    }
    if (
      result.analysis.status === "complete" &&
      result.privacy.externalEvidenceCount !== result.analysis.evidenceIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "External evidence count must match the validated analysis evidence set.",
        path: ["privacy", "externalEvidenceCount"],
      });
    }
  });

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const PersistedReviewIdentitySchema = z.object({
  repositoryId: z.string().min(1),
  checkpointId: z.string().min(1),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
  analysisSchemaVersion: z.string().min(1),
  analysisPromptVersion: z.string().min(1),
  providerConfigurationId: z.string().min(1),
});

export type PersistedReviewIdentity = z.infer<typeof PersistedReviewIdentitySchema>;

export const PersistedReviewRecordSchema = z.object({
  identity: PersistedReviewIdentitySchema,
  createdAt: z.string().datetime(),
  result: ReviewResultSchema,
});

export type PersistedReviewRecord = z.infer<typeof PersistedReviewRecordSchema>;

export const CheckpointFixtureSchema = z.object({
  label: z.string().min(1),
  checkpoints: z.array(CheckpointEvidenceBundleSchema),
});

export type CheckpointFixture = z.infer<typeof CheckpointFixtureSchema>;

export const BootstrapResponseSchema = z.object({
  repository: RepositoryContextSchema,
  checkpointSource: z.object({
    kind: z.enum(["entire-cli", "fixture"]),
    label: z.string().min(1),
  }),
  checkpoints: z.array(CheckpointSummarySchema),
});

export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
