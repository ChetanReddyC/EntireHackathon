import { Router } from "express";

import { createAnalysisProvider } from "./analysisProvider.js";
import type { AppConfig } from "./config.js";
import { createCheckpointSource } from "./checkpointSource.js";
import { createEvidenceRetriever } from "./evidenceRetriever.js";
import { ensureReview } from "./reviewOrchestrator.js";
import { resolveRepositoryContext } from "./repositoryContext.js";
import { createReviewStore } from "./reviewStore.js";

export function createApiRouter(config: AppConfig): Router {
  const router = Router();
  const checkpointSource = createCheckpointSource(config);
  const evidenceRetriever = createEvidenceRetriever(config);
  const analysisProvider = createAnalysisProvider(config);
  const reviewStore = createReviewStore(config);

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
      const repository = await resolveRepositoryContext(config.repositoryRoot);
      response.json(
        await ensureReview(
          repository.id,
          checkpointId,
          { checkpointSource: source, evidenceRetriever, analysisProvider, reviewStore },
          { reanalyze: request.query.reanalyze === "true" },
        ),
      );
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
