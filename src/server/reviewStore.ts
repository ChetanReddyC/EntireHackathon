import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

import {
  PersistedReviewRecordSchema,
  type PersistedReviewIdentity,
  type PersistedReviewRecord,
  type ReviewResult,
} from "../shared/contracts.js";
import type { AppConfig } from "./config.js";
import { calculateIntentGuardScore } from "./scoring.js";

export type ReviewStore = {
  read(identity: PersistedReviewIdentity): Promise<ReviewResult | undefined>;
  write(identity: PersistedReviewIdentity, result: ReviewResult): Promise<void>;
};

function identitiesMatch(left: PersistedReviewIdentity, right: PersistedReviewIdentity): boolean {
  return (
    left.repositoryId === right.repositoryId &&
    left.checkpointId === right.checkpointId &&
    left.evidenceHash === right.evidenceHash &&
    left.analysisSchemaVersion === right.analysisSchemaVersion &&
    left.analysisPromptVersion === right.analysisPromptVersion &&
    left.providerConfigurationId === right.providerConfigurationId
  );
}

function safeName(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertDeterministicScore(result: ReviewResult): void {
  if (
    result.analysis.status === "complete" &&
    result.score !== calculateIntentGuardScore(result.signals)
  ) {
    throw new Error("Persisted review score does not match its validated signals.");
  }
}

export function defaultReviewStoreRoot(): string {
  if (process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, "CheckpointLens", "reviews");
  }
  if (process.env.XDG_DATA_HOME) {
    return join(process.env.XDG_DATA_HOME, "checkpoint-lens", "reviews");
  }
  return join(homedir(), ".checkpoint-lens", "reviews");
}

export class FileReviewStore implements ReviewStore {
  constructor(private readonly root: string = defaultReviewStoreRoot()) {}

  async read(identity: PersistedReviewIdentity): Promise<ReviewResult | undefined> {
    try {
      const record = PersistedReviewRecordSchema.parse(
        JSON.parse(await readFile(this.recordPath(identity), "utf8")),
      );
      assertDeterministicScore(record.result);
      return identitiesMatch(record.identity, identity) ? record.result : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async write(identity: PersistedReviewIdentity, result: ReviewResult): Promise<void> {
    const record: PersistedReviewRecord = PersistedReviewRecordSchema.parse({
      identity,
      createdAt: new Date().toISOString(),
      result,
    });
    assertDeterministicScore(record.result);
    const path = this.recordPath(identity);
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  }

  private recordPath(identity: PersistedReviewIdentity): string {
    return join(this.root, safeName(identity.repositoryId), `${safeName(identity.checkpointId)}.json`);
  }
}

export function createReviewStore(config: AppConfig): ReviewStore {
  return new FileReviewStore(config.reviewStoreRoot);
}
