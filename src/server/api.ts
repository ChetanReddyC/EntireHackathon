import { Router } from "express";

import type { AppConfig } from "./config.js";
import { createCheckpointSource } from "./checkpointSource.js";
import { createEvidenceRetriever } from "./evidenceRetriever.js";
import { buildLocalReview } from "./localReview.js";
import { resolveRepositoryContext } from "./repositoryContext.js";

export function createApiRouter(config: AppConfig): Router {
  const router = Router();
  const checkpointSource = createCheckpointSource(config);
  const evidenceRetriever = createEvidenceRetriever(config);

  router.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  router.get("/bootstrap", async (_request, response, next) => {
    try {
      const source = await checkpointSource;
      const repository = await resolveRepositoryContext(config.repositoryRoot);
      const checkpoints = await source.listCheckpoints();
      response.json({
        repository,
        checkpointSource: { kind: source.kind, label: source.label },
        checkpoints,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/checkpoints/:checkpointId/review", async (request, response, next) => {
    try {
      const source = await checkpointSource;
      const checkpointId = request.params.checkpointId;
      const evidence = await source.getCheckpointEvidence(checkpointId);
      const retrieval = await evidenceRetriever.retrieve(evidence);
      response.json(buildLocalReview(evidence, retrieval));
    } catch (error) {
      next(error);
    }
  });

  router.post("/evidence/sync", async (_request, response, next) => {
    try {
      response.json(await evidenceRetriever.synchronize());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
