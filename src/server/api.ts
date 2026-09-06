import { Router } from "express";

import type { AppConfig } from "./config.js";
import { resolveRepositoryContext } from "./repositoryContext.js";

export function createApiRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  router.get("/bootstrap", async (_request, response, next) => {
    try {
      const repository = await resolveRepositoryContext(config.repositoryRoot);
      response.json({ repository, checkpointSource: "pending" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
