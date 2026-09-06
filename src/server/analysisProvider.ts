import { createHash } from "node:crypto";

import { z } from "zod";

import {
  SemanticAnalysisSchema,
  type SemanticAnalysis,
} from "../shared/contracts.js";
import type { AnalysisInput } from "./analysisPrompt.js";
import { buildAnalysisMessages } from "./analysisPrompt.js";
import type { AppConfig } from "./config.js";

export type AnalysisProvider = {
  available: boolean;
  kind: "agentrouter" | "deepseek" | "local";
  label: string;
  configurationId: string;
  analyze(input: AnalysisInput): Promise<SemanticAnalysis>;
};

export class AnalysisUnavailableError extends Error {}

const ChatCompletionResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().min(1),
      }),
    }),
  ).min(1),
});

const semanticAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "signals"],
  properties: {
    summary: { type: "string", minLength: 1 },
    signals: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "status", "title", "rationale", "confidence", "evidenceIds"],
        properties: {
          id: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["Done", "Missing", "Drifted", "Risky"] },
          title: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
          confidence: { type: "string", enum: ["supported", "limited"] },
          evidenceIds: { type: "array", items: { type: "string", minLength: 1 } },
        },
      },
    },
  },
} as const;

function agentRouterChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${base.endsWith("/v1") ? "" : "/v1"}/chat/completions`;
}

function deepSeekChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

async function responseContent(response: Response, providerLabel: string): Promise<string> {
  if (!response.ok) {
    if (providerLabel === "DeepSeek" && response.status === 402) {
      throw new AnalysisUnavailableError("DeepSeek API balance is insufficient (HTTP 402). Add API credit, then retry analysis.");
    }
    if (response.status === 401) {
      throw new AnalysisUnavailableError(`${providerLabel} authentication failed (HTTP 401). Check the server-side API key.`);
    }
    if (response.status === 429) {
      throw new AnalysisUnavailableError(`${providerLabel} rate limit was reached (HTTP 429). Retry shortly.`);
    }
    throw new AnalysisUnavailableError(`${providerLabel} returned HTTP ${response.status}.`);
  }
  const payload = ChatCompletionResponseSchema.parse(await response.json());
  return payload.choices[0].message.content;
}

class UnavailableAnalysisProvider implements AnalysisProvider {
  readonly available = false;
  readonly kind = "local" as const;
  readonly label = "Semantic analysis provider";
  readonly configurationId: string;

  constructor(model: string) {
    this.configurationId = `analysis-provider:unconfigured:${model}`;
  }

  analyze(): Promise<SemanticAnalysis> {
    return Promise.reject(new AnalysisUnavailableError("No semantic analysis provider is configured."));
  }
}

class AgentRouterAnalysisProvider implements AnalysisProvider {
  readonly available = true;
  readonly kind = "agentrouter" as const;
  readonly label = "AgentRouter";
  readonly configurationId: string;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    const digest = createHash("sha256")
      .update(`${baseUrl}\0${model}\0medium`)
      .digest("hex")
      .slice(0, 16);
    this.configurationId = `agentrouter:${digest}`;
  }

  async analyze(input: AnalysisInput): Promise<SemanticAnalysis> {
    let response: Response;
    try {
      response = await fetch(agentRouterChatCompletionsUrl(this.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          reasoning_effort: "medium",
          messages: buildAnalysisMessages(input),
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "checkpoint_semantic_analysis",
              strict: true,
              schema: semanticAnalysisJsonSchema,
            },
          },
          max_completion_tokens: 2_000,
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown transport failure.";
      throw new AnalysisUnavailableError(`AgentRouter request failed: ${detail}`);
    }

    const content: unknown = JSON.parse(await responseContent(response, this.label));
    return SemanticAnalysisSchema.parse(content);
  }
}

class DeepSeekAnalysisProvider implements AnalysisProvider {
  readonly available = true;
  readonly kind = "deepseek" as const;
  readonly label = "DeepSeek";
  readonly configurationId: string;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    const digest = createHash("sha256")
      .update(`${baseUrl}\0${model}\0medium\0json-object`)
      .digest("hex")
      .slice(0, 16);
    this.configurationId = `deepseek:${digest}`;
  }

  async analyze(input: AnalysisInput): Promise<SemanticAnalysis> {
    let response: Response;
    try {
      response = await fetch(deepSeekChatCompletionsUrl(this.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          reasoning_effort: "medium",
          messages: buildAnalysisMessages(input),
          response_format: { type: "json_object" },
          max_tokens: 2_000,
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown transport failure.";
      throw new AnalysisUnavailableError(`DeepSeek request failed: ${detail}`);
    }

    const content: unknown = JSON.parse(await responseContent(response, this.label));
    return SemanticAnalysisSchema.parse(content);
  }
}

export function createAnalysisProvider(config: AppConfig): AnalysisProvider {
  if (config.deepSeekApiKey) {
    return new DeepSeekAnalysisProvider(
      config.deepSeekBaseUrl,
      config.deepSeekApiKey,
      config.deepSeekModel,
    );
  }
  if (!config.agentRouterApiKey || !config.agentRouterBaseUrl) {
    return new UnavailableAnalysisProvider(config.agentRouterModel);
  }
  return new AgentRouterAnalysisProvider(
    config.agentRouterBaseUrl,
    config.agentRouterApiKey,
    config.agentRouterModel,
  );
}
