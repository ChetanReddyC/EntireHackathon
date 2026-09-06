import {
  ApiErrorSchema,
  BootstrapResponseSchema,
  ReviewResultSchema,
  type BootstrapResponse,
  type ReviewResult,
} from "../shared/contracts";

function errorMessage(payload: unknown, fallback: string): string {
  const parsed = ApiErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : fallback;
}

async function responsePayload(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

export async function loadBootstrap(signal?: AbortSignal): Promise<BootstrapResponse> {
  const response = await fetch("/api/bootstrap", { signal });
  const payload = await responsePayload(response);

  if (!response.ok) {
    throw new Error(errorMessage(payload, "Repository context could not be loaded."));
  }

  return BootstrapResponseSchema.parse(payload);
}

export async function loadReview(
  checkpointId: string,
  signal?: AbortSignal,
  reanalyze = false,
): Promise<ReviewResult> {
  const query = reanalyze ? "?reanalyze=true" : "";
  const response = await fetch(`/api/checkpoints/${encodeURIComponent(checkpointId)}/review${query}`, { signal });
  const payload = await responsePayload(response);

  if (!response.ok) {
    throw new Error(errorMessage(payload, "Checkpoint review could not be loaded."));
  }

  return ReviewResultSchema.parse(payload);
}
