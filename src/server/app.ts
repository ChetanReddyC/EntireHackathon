import { existsSync } from "node:fs";
import { resolve } from "node:path";

import express, { type ErrorRequestHandler } from "express";

import { createApiRouter } from "./api.js";
import type { AppConfig } from "./config.js";

export function createApp(config: AppConfig) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(config));

  const clientDirectory = resolve(process.cwd(), "dist");
  if (config.isProduction && existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory));
    app.use((_request, response) => {
      response.sendFile(resolve(clientDirectory, "index.html"));
    });
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    });
  };

  app.use(errorHandler);
  return app;
}
