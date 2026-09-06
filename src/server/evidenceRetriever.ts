import { z } from "zod";

import {
  EvidenceRetrievalSchema,
  type CheckpointEvidenceBundle,
  type EvidenceRetrieval,
} from "../shared/contracts.js";
import type { AppConfig } from "./config.js";
import { createExternalEvidenceProjection } from "./privacy.js";

export type EvidenceRetriever = {
  retrieve(bundle: CheckpointEvidenceBundle): Promise<EvidenceRetrieval>;
  synchronize(): Promise<{ status: "requested" | "unavailable"; notice: string }>;
};

const DatabricksQueryResponseSchema = z.object({
  manifest: z.object({
    columns: z.array(z.object({ name: z.string() }).passthrough()),
  }),
  result: z.object({
    data_array: z.array(z.array(z.unknown())).default([]),
  }),
});

class LocalEvidenceRetriever implements EvidenceRetriever {
  retrieve(bundle: CheckpointEvidenceBundle): Promise<EvidenceRetrieval> {
    const projection = createExternalEvidenceProjection(bundle);
    return Promise.resolve({
      source: "local-fallback",
      status: "ready",
      evidenceIds: projection.evidence.map((item) => item.id),
      notice: "Databricks is not configured; using canonical local Checkpoint evidence.",
    });
  }

  synchronize(): Promise<{ status: "unavailable"; notice: string }> {
    return Promise.resolve({
      status: "unavailable",
      notice: "Databricks synchronization is unavailable because the adapter is not configured.",
    });
  }
}

class DatabricksEvidenceRetriever implements EvidenceRetriever {
  private readonly host: string;

  constructor(
    host: string,
    private readonly token: string,
    private readonly indexName: string,
  ) {
    this.host = host.replace(/\/$/, "");
  }

  async retrieve(bundle: CheckpointEvidenceBundle): Promise<EvidenceRetrieval> {
    const projection = createExternalEvidenceProjection(bundle);
    if (projection.evidence.length === 0) {
      return {
        source: "local-fallback",
        status: "unavailable",
        evidenceIds: [],
        notice: "No evidence is authorized for external retrieval; sensitive context remains local.",
      };
    }

    const canonicalEvidence = new Map(projection.evidence.map((item) => [item.id, item]));
    const queryText = projection.evidence.map((item) => `${item.type}: ${item.label}`).join("\n");

    try {
      const payload = await this.request("query", {
        columns: ["evidence_id", "checkpoint_id", "content_hash"],
        filters_json: JSON.stringify({ checkpoint_id: bundle.checkpoint.id }),
        num_results: Math.min(8, projection.evidence.length),
        query_text: queryText,
        query_type: "HYBRID",
      });
      const parsed = DatabricksQueryResponseSchema.parse(payload);
      const names = parsed.manifest.columns.map((column) => column.name);
      const evidenceIndex = names.indexOf("evidence_id");
      const checkpointIndex = names.indexOf("checkpoint_id");
      const hashIndex = names.indexOf("content_hash");

      const evidenceIds = parsed.result.data_array.flatMap((row) => {
        const evidenceId = evidenceIndex >= 0 ? row[evidenceIndex] : undefined;
        const checkpointId = checkpointIndex >= 0 ? row[checkpointIndex] : undefined;
        const contentHash = hashIndex >= 0 ? row[hashIndex] : undefined;
        if (
          typeof evidenceId !== "string" ||
          checkpointId !== bundle.checkpoint.id ||
          typeof contentHash !== "string"
        ) {
          return [];
        }
        const canonical = canonicalEvidence.get(evidenceId);
        return canonical?.contentHash === contentHash ? [canonical.id] : [];
      });

      return EvidenceRetrievalSchema.parse({
        source: "databricks",
        status: "ready",
        evidenceIds: [...new Set(evidenceIds)],
        notice:
          evidenceIds.length > 0
            ? "Databricks hits resolved to canonical local Entire evidence."
            : "Databricks returned no canonical evidence matches; local evidence remains available.",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown retrieval error.";
      return {
        source: "local-fallback",
        status: "unavailable",
        evidenceIds: projection.evidence.map((item) => item.id),
        notice: `Databricks retrieval unavailable; using canonical local evidence. ${detail}`,
      };
    }
  }

  async synchronize(): Promise<{ status: "requested"; notice: string }> {
    await this.request("sync", {});
    return {
      status: "requested",
      notice: "Databricks Delta Sync was requested. No Checkpoint prompt or transcript data was uploaded.",
    };
  }

  private async request(action: "query" | "sync", body: Record<string, unknown>): Promise<unknown> {
    const index = encodeURIComponent(this.indexName);
    const response = await fetch(
      `${this.host}/api/2.0/vector-search/indexes/${index}/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Databricks ${action} failed with HTTP ${response.status}.`);
    }
    if (response.status === 204) {
      return {};
    }
    return response.json();
  }
}

export function createEvidenceRetriever(config: AppConfig): EvidenceRetriever {
  if (config.databricksHost && config.databricksToken && config.databricksSearchIndex) {
    return new DatabricksEvidenceRetriever(
      config.databricksHost,
      config.databricksToken,
      config.databricksSearchIndex,
    );
  }
  return new LocalEvidenceRetriever();
}
