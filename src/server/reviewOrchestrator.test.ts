import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CheckpointEvidenceBundleSchema,
  CheckpointFixtureSchema,
  type CheckpointEvidenceBundle,
} from "../shared/contracts.js";
import type { AnalysisInput } from "./analysisPrompt.js";
import type { AnalysisProvider } from "./analysisProvider.js";
import type { CheckpointSource } from "./checkpointSource.js";
import type { EvidenceRetriever } from "./evidenceRetriever.js";
import { ensureReview } from "./reviewOrchestrator.js";
import { FileReviewStore } from "./reviewStore.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function sourceFor(bundle: CheckpointEvidenceBundle): CheckpointSource {
  return {
    kind: "fixture",
    label: "Test fixture",
    listCheckpoints: () => Promise.resolve([bundle.checkpoint]),
    getCheckpointEvidence: () => Promise.resolve(bundle),
  };
}

function completeBundle(): CheckpointEvidenceBundle {
  const secret = "private customer migration prompt";
  return CheckpointEvidenceBundleSchema.parse({
    checkpoint: {
      id: "checkpoint-complete",
      title: "Implement migration guard",
      createdAt: "2026-09-06T07:00:00.000Z",
      contextCompleteness: "complete",
    },
    prompt: { availability: "available", value: secret },
    transcript: { availability: "available", value: "Transcript available locally." },
    metadataPartial: false,
    outcome: "Migration validation was implemented.",
    openItems: [],
    friction: [],
    evidence: [
      {
        id: "file-guard",
        type: "file",
        label: "src/migrationGuard.ts",
        content: "Changed file recorded by Entire: src/migrationGuard.ts",
        contentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        provenance: {
          source: "entire-checkpoint",
          checkpointId: "checkpoint-complete",
          locator: "file:src/migrationGuard.ts",
        },
        handling: "shareable",
      },
      {
        id: "private-prompt",
        type: "prompt",
        label: "Original intent",
        content: secret,
        contentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        provenance: {
          source: "entire-checkpoint",
          checkpointId: "checkpoint-complete",
          locator: "session-summary:intent",
        },
        handling: "local-only",
      },
    ],
  });
}

const retrieval: EvidenceRetriever = {
  retrieve: (bundle) => Promise.resolve({
    source: "databricks",
    status: "ready",
    evidenceIds: [bundle.evidence[0].id],
    notice: "Resolved one canonical hit.",
  }),
  synchronize: () => Promise.resolve({ status: "requested", notice: "Sync requested." }),
};

describe("review orchestration", () => {
  it("keeps incomplete Checkpoint review entirely local and provisional", async () => {
    const fixture = CheckpointFixtureSchema.parse(
      JSON.parse(await readFile("src/server/testdata/redacted-checkpoints.json", "utf8")),
    );
    const bundle = fixture.checkpoints[0];
    let retrievalCalls = 0;
    let analysisCalls = 0;
    const blockedRetriever: EvidenceRetriever = {
      retrieve: () => {
        retrievalCalls += 1;
        return Promise.reject(new Error("External retrieval must not run."));
      },
      synchronize: () => Promise.resolve({ status: "unavailable", notice: "Unavailable." }),
    };
    const blockedProvider: AnalysisProvider = {
      available: true,
      kind: "deepseek",
      label: "DeepSeek",
      configurationId: "test-provider",
      analyze: () => {
        analysisCalls += 1;
        return Promise.reject(new Error("External analysis must not run."));
      },
    };
    const root = await mkdtemp(join(tmpdir(), "checkpoint-lens-incomplete-"));
    temporaryDirectories.push(root);

    const review = await ensureReview(
      "repository-test",
      bundle.checkpoint.id,
      {
        checkpointSource: sourceFor(bundle),
        evidenceRetriever: blockedRetriever,
        analysisProvider: blockedProvider,
        reviewStore: new FileReviewStore(root),
      },
    );

    expect(retrievalCalls).toBe(0);
    expect(analysisCalls).toBe(0);
    expect(review.contextCompleteness).toBe("incomplete");
    expect(review.authority).toBe("provisional");
    expect(review.score).toBeNull();
    expect(review.analysis.status).toBe("not-run");
  });

  it("scores, persists, and reuses a validated complete review without exposing raw context", async () => {
    const bundle = completeBundle();
    const capturedInputs: AnalysisInput[] = [];
    const provider: AnalysisProvider = {
      available: true,
      kind: "deepseek",
      label: "DeepSeek",
      configurationId: "agentrouter:test",
      analyze: (input) => {
        capturedInputs.push(input);
        return Promise.resolve({
          summary: "The migration guard is implemented, with verification still required.",
          signals: [
            {
              id: "guard-present",
              status: "Done",
              title: "Migration guard exists",
              rationale: "The changed-file evidence records the migration guard module.",
              confidence: "supported",
              evidenceIds: ["file-guard"],
            },
            {
              id: "verification-needed",
              status: "Risky",
              title: "Verification is not established",
              rationale: "No allowlisted test evidence was supplied.",
              confidence: "limited",
              evidenceIds: ["file-guard"],
            },
          ],
        });
      },
    };
    const root = await mkdtemp(join(tmpdir(), "checkpoint-lens-cache-"));
    temporaryDirectories.push(root);

    const first = await ensureReview(
      "repository-test",
      bundle.checkpoint.id,
      {
        checkpointSource: sourceFor(bundle),
        evidenceRetriever: retrieval,
        analysisProvider: provider,
        reviewStore: new FileReviewStore(root),
      },
    );
    const second = await ensureReview(
      "repository-test",
      bundle.checkpoint.id,
      {
        checkpointSource: sourceFor(bundle),
        evidenceRetriever: retrieval,
        analysisProvider: provider,
        reviewStore: new FileReviewStore(root),
      },
    );

    expect(first.score).toBe(75);
    expect(first.analysis.persistence).toBe("stored");
    expect(second.analysis.cache).toBe("hit");
    expect(capturedInputs).toHaveLength(1);
    expect(JSON.stringify(capturedInputs[0])).not.toContain("private customer migration prompt");
    expect(capturedInputs[0].evidence.map((evidence) => evidence.id)).toEqual(["file-guard"]);
  });

  it("rejects model signals that cite unknown evidence", async () => {
    const bundle = completeBundle();
    const invalidProvider: AnalysisProvider = {
      available: true,
      kind: "deepseek",
      label: "DeepSeek",
      configurationId: "agentrouter:invalid-test",
      analyze: () => Promise.resolve({
        summary: "Invalid evidence response.",
        signals: [
          {
            id: "invented-reference",
            status: "Done",
            title: "Unsupported result",
            rationale: "This cites evidence that was never supplied.",
            confidence: "supported",
            evidenceIds: ["invented-evidence"],
          },
        ],
      }),
    };
    const root = await mkdtemp(join(tmpdir(), "checkpoint-lens-invalid-"));
    temporaryDirectories.push(root);

    await expect(
      ensureReview(
        "repository-test",
        bundle.checkpoint.id,
        {
          checkpointSource: sourceFor(bundle),
          evidenceRetriever: retrieval,
          analysisProvider: invalidProvider,
          reviewStore: new FileReviewStore(root),
        },
      ),
    ).rejects.toThrow("unknown evidence ID");
  });
});
