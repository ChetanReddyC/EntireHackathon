import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CheckpointFixtureSchema } from "../shared/contracts.js";
import { buildLocalReview } from "./localReview.js";
import { createExternalEvidenceProjection } from "./privacy.js";

describe("sensitive Checkpoint handling", () => {
  it("keeps redacted or missing context useful without presenting it as complete", async () => {
    const fixturePath = resolve("src/server/testdata/redacted-checkpoints.json");
    const fixture = CheckpointFixtureSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));
    const bundle = fixture.checkpoints[0];
    const review = buildLocalReview(bundle);

    expect(review.contextCompleteness).toBe("incomplete");
    expect(review.authority).toBe("provisional");
    expect(review.score).toBeNull();
    expect(review.summary).toContain("Provisional local review");
    expect(review.evidence).toHaveLength(3);
    expect(review.handoff.nextStep).toContain("authorized intent context");
  });

  it("excludes raw prompt and transcript evidence even when handling is misclassified", () => {
    const secret = "raw-sensitive-prompt-do-not-send";
    const bundle = CheckpointFixtureSchema.parse({
      label: "Privacy projection fixture",
      checkpoints: [
        {
          checkpoint: {
            id: "checkpoint-private",
            title: "Private checkpoint",
            createdAt: "2026-09-06T06:10:00.000Z",
            contextCompleteness: "complete",
          },
          prompt: { availability: "available", value: secret },
          transcript: { availability: "available", value: `${secret}-transcript` },
          metadataPartial: false,
          evidence: [
            {
              id: "private-prompt",
              type: "prompt",
              label: "Prompt",
              content: secret,
              contentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              provenance: {
                source: "entire-checkpoint",
                checkpointId: "checkpoint-private",
                locator: "session-summary:intent",
              },
              handling: "shareable",
            },
            {
              id: "safe-file",
              type: "file",
              label: "src/server/api.ts",
              content: "Changed file recorded by Entire: src/server/api.ts",
              contentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              provenance: {
                source: "entire-checkpoint",
                checkpointId: "checkpoint-private",
                locator: "file:src/server/api.ts",
              },
              handling: "shareable",
            },
          ],
        },
      ],
    }).checkpoints[0];

    const serialized = JSON.stringify(createExternalEvidenceProjection(bundle));
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("safe-file");
  });
});
