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
    handoff: z.object({
      originalIntent: z.string().min(1),
      completedWork: z.string().min(1),
      missingWork: z.array(z.string().min(1)),
      risks: z.array(z.string().min(1)),
      nextStep: z.string().min(1),
    }),
    privacy: z.object({
      processing: z.literal("local-only"),
      externalEvidenceCount: z.number().int().nonnegative(),
      sensitiveFieldsExcluded: z.array(z.enum(["prompt", "transcript"])),
    }),
  })
  .superRefine((result, context) => {
    if (result.contextCompleteness !== "incomplete") {
      return;
    }
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
  });

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

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
