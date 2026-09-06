import { z } from "zod";

const ConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  repositoryRoot: z.string().min(1),
  checkpointFixturePath: z.string().min(1).optional(),
  deepSeekApiKey: z.string().min(1).optional(),
  deepSeekBaseUrl: z.string().url(),
  deepSeekModel: z.string().min(1),
  agentRouterApiKey: z.string().min(1).optional(),
  agentRouterBaseUrl: z.string().url().optional(),
  agentRouterModel: z.string().min(1),
  databricksHost: z.string().url().optional(),
  databricksToken: z.string().min(1).optional(),
  databricksSearchIndex: z.string().min(1).optional(),
  reviewStoreRoot: z.string().min(1).optional(),
  isProduction: z.boolean(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
  const parsedPort = Number(process.env.PORT ?? "8787");

  return ConfigSchema.parse({
    host: process.env.HOST ?? "127.0.0.1",
    port: parsedPort,
    repositoryRoot: process.env.REPOSITORY_ROOT || process.cwd(),
    checkpointFixturePath: process.env.CHECKPOINT_FIXTURE_PATH || undefined,
    deepSeekApiKey: process.env.DEEPSEEK_API_KEY || undefined,
    deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    deepSeekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    agentRouterApiKey: process.env.AGENTROUTER_API_KEY || undefined,
    agentRouterBaseUrl: process.env.AGENTROUTER_BASE_URL || undefined,
    agentRouterModel: process.env.AGENTROUTER_MODEL || "gpt-5.6-sol",
    databricksHost: process.env.DATABRICKS_HOST || undefined,
    databricksToken: process.env.DATABRICKS_TOKEN || undefined,
    databricksSearchIndex: process.env.DATABRICKS_SEARCH_INDEX || undefined,
    reviewStoreRoot: process.env.REVIEW_STORE_ROOT || undefined,
    isProduction: process.env.NODE_ENV === "production",
  });
}
