import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisInput } from "./analysisPrompt.js";
import { createAnalysisProvider } from "./analysisProvider.js";
import type { AppConfig } from "./config.js";

afterEach(() => vi.unstubAllGlobals());

const config: AppConfig = {
  host: "127.0.0.1",
  port: 8787,
  repositoryRoot: ".",
  deepSeekApiKey: "test-deepseek-key",
  deepSeekBaseUrl: "https://api.deepseek.com",
  deepSeekModel: "deepseek-v4-flash",
  agentRouterModel: "gpt-5.6-sol",
  isProduction: false,
};

const input: AnalysisInput = {
  checkpoint: { id: "checkpoint-safe", title: "Privacy-safe review" },
  contextAvailability: {
    prompt: "available",
    transcript: "available",
    metadataPartial: false,
  },
  evidence: [
    {
      id: "file-safe",
      type: "file",
      label: "src/server/privacy.ts",
      content: "Changed file recorded by Entire: src/server/privacy.ts",
      contentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      provenance: {
        source: "entire-checkpoint",
        checkpointId: "checkpoint-safe",
        locator: "file:src/server/privacy.ts",
      },
      handling: "shareable",
    },
  ],
};

describe("DeepSeek analysis provider", () => {
  it("uses DeepSeek JSON mode and returns schema-validated signals", async () => {
    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "The privacy boundary is represented by canonical file evidence.",
                signals: [
                  {
                    id: "privacy-file-present",
                    status: "Done",
                    title: "Privacy boundary implementation recorded",
                    rationale: "The supplied file evidence records the privacy module.",
                    confidence: "supported",
                    evidenceIds: ["file-safe"],
                  },
                ],
              }),
            },
          },
        ],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnalysisProvider(config);
    const result = await provider.analyze(input);

    expect(provider.kind).toBe("deepseek");
    expect(result.signals[0].evidenceIds).toEqual(["file-safe"]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(String(url)).toBe("https://api.deepseek.com/chat/completions");
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(body)).not.toContain("test-deepseek-key");
  });
});
