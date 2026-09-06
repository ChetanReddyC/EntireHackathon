import { z } from "zod";

export const RepositoryContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
});

export type RepositoryContext = z.infer<typeof RepositoryContextSchema>;

export const BootstrapResponseSchema = z.object({
  repository: RepositoryContextSchema,
  checkpointSource: z.literal("pending"),
});

export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
