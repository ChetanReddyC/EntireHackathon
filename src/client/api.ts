import { BootstrapResponseSchema, type BootstrapResponse } from "../shared/contracts";

export async function loadBootstrap(signal?: AbortSignal): Promise<BootstrapResponse> {
  const response = await fetch("/api/bootstrap", { signal });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error("Repository context could not be loaded.");
  }

  return BootstrapResponseSchema.parse(payload);
}
