import {
  BootstrapResponseSchema,
  ReviewResultSchema,
  type BootstrapResponse,
  type ReviewResult,
} from "../shared/contracts";

export async function loadBootstrap(signal?: AbortSignal): Promise<BootstrapResponse> {
  const response = await fetch("/api/bootstrap", { signal });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error("Repository context could not be loaded.");
  }

  return BootstrapResponseSchema.parse(payload);
}

export async function loadReview(checkpointId: string, signal?: AbortSignal): Promise<ReviewResult> {
  const response = await fetch(`/api/checkpoints/${encodeURIComponent(checkpointId)}/review`, { signal });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error("Checkpoint review could not be loaded.");
  }

  return ReviewResultSchema.parse(payload);
}
