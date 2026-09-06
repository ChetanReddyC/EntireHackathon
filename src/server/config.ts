import { z } from "zod";

const ConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  repositoryRoot: z.string().min(1),
  isProduction: z.boolean(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
  const parsedPort = Number(process.env.PORT ?? "8787");

  return ConfigSchema.parse({
    host: process.env.HOST ?? "127.0.0.1",
    port: parsedPort,
    repositoryRoot: process.env.REPOSITORY_ROOT || process.cwd(),
    isProduction: process.env.NODE_ENV === "production",
  });
}
