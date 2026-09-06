import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  CheckpointEvidenceBundleSchema,
  CheckpointFixtureSchema,
  type CheckpointEvidenceBundle,
  type CheckpointSummary,
  type ContextField,
  type Evidence,
} from "../shared/contracts.js";
import type { AppConfig } from "./config.js";

type CheckpointSource = {
  kind: "entire-cli" | "fixture";
  label: string;
  listCheckpoints(): Promise<CheckpointSummary[]>;
  getCheckpointEvidence(checkpointId: string): Promise<CheckpointEvidenceBundle>;
};

const RawCheckpointListSchema = z.array(
  z.object({
    checkpoint_id: z.string().min(1),
    agent: z.string().min(1).optional(),
    date: z.string().min(1),
    message: z.string().optional(),
  }),
);

const RawCheckpointDetailSchema = z.object({
  checkpoint_id: z.string().min(1),
  branch: z.string().min(1).optional(),
  files_touched: z.array(z.string()).optional(),
  partial: z.boolean().optional(),
  sessions: z.array(
    z.object({
      created_at: z.string().optional(),
      files_touched: z.array(z.string()).optional(),
      error: z.string().optional(),
      summary: z
        .object({
          intent: z.string().optional(),
          outcome: z.string().optional(),
          friction: z.array(z.string()).optional(),
          open_items: z.array(z.string()).optional(),
        })
        .optional(),
    }),
  ),
});

function stableEvidenceId(checkpointId: string, type: Evidence["type"], value: string): string {
  const digest = createHash("sha256").update(`${checkpointId}\0${type}\0${value}`).digest("hex").slice(0, 12);
  return `${checkpointId}:${type}:${digest}`;
}

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRedacted(value: string): boolean {
  return /\[(?:redacted|removed|filtered)\]|<redacted>|\*{3,}/i.test(value);
}

function toDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid Checkpoint date: ${value}`);
  }
  return date.toISOString();
}

function runEntire(args: string[], cwd: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(
      "entire",
      args,
      { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (!error || stdout.trim()) {
          resolveOutput(stdout);
          return;
        }
        reject(new Error(stderr.trim() || error.message));
      },
    );
  });
}

function contextField(value: string | undefined, missingReason: string): ContextField {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { availability: "unavailable", reason: missingReason };
  }
  if (isRedacted(trimmed)) {
    return { availability: "redacted", reason: "Checkpoint policy removed sensitive content." };
  }
  return { availability: "available", value: trimmed };
}

class EntireCliCheckpointSource implements CheckpointSource {
  readonly kind = "entire-cli" as const;
  readonly label = "Entire CLI - local repository";
  private readonly summaries = new Map<string, CheckpointSummary>();

  constructor(private readonly repositoryRoot: string) {}

  async listCheckpoints(): Promise<CheckpointSummary[]> {
    const raw = await runEntire(["checkpoint", "list", "--json"], this.repositoryRoot);
    const checkpoints = RawCheckpointListSchema.parse(JSON.parse(raw || "[]")).map((item) => ({
      id: item.checkpoint_id,
      title: item.message?.trim() || `Checkpoint ${item.checkpoint_id.slice(0, 8)}`,
      createdAt: toDate(item.date),
      agent: item.agent,
      contextCompleteness: "unknown" as const,
    }));
    checkpoints.forEach((checkpoint) => this.summaries.set(checkpoint.id, checkpoint));
    return checkpoints;
  }

  async getCheckpointEvidence(checkpointId: string): Promise<CheckpointEvidenceBundle> {
    const metadataRaw = await runEntire(
      ["checkpoint", "explain", checkpointId, "--json"],
      this.repositoryRoot,
    );
    const detail = RawCheckpointDetailSchema.parse(JSON.parse(metadataRaw));
    if (detail.checkpoint_id !== checkpointId) {
      throw new Error("Entire returned a different Checkpoint than requested.");
    }

    const transcriptRaw = await runEntire(
      ["checkpoint", "explain", checkpointId, "--transcript"],
      this.repositoryRoot,
    ).catch(() => "");
    const summaries = detail.sessions.flatMap((session) => (session.summary ? [session.summary] : []));
    const files = [...new Set([...(detail.files_touched ?? []), ...detail.sessions.flatMap((s) => s.files_touched ?? [])])];
    const prompt = contextField(
      summaries.map((summary) => summary.intent).find((intent) => intent?.trim()),
      "No authorized intent summary is available in Checkpoint metadata.",
    );
    const transcript: ContextField = transcriptRaw.trim()
      ? isRedacted(transcriptRaw)
        ? { availability: "redacted", reason: "Checkpoint policy removed sensitive transcript content." }
        : {
            availability: "available",
            value: "Transcript is available locally and is excluded from external evidence.",
          }
      : { availability: "unavailable", reason: "No transcript content is available to the local adapter." };
    const fallback = this.summaries.get(checkpointId);
    const createdAt =
      fallback?.createdAt ??
      toDate(detail.sessions.map((session) => session.created_at).find(Boolean) ?? new Date(0).toISOString());
    const contextCompleteness =
      prompt.availability === "available" &&
      transcript.availability === "available" &&
      !detail.partial &&
      !detail.sessions.some((session) => session.error)
        ? "complete"
        : "incomplete";
    const checkpoint: CheckpointSummary = {
      id: checkpointId,
      title: fallback?.title ?? `Checkpoint ${checkpointId.slice(0, 8)}`,
      createdAt,
      agent: fallback?.agent,
      branch: detail.branch,
      contextCompleteness,
    };
    const evidence: Evidence[] = files.map((file) => {
      const content = `Changed file recorded by Entire: ${file}`;
      return {
        id: stableEvidenceId(checkpointId, "file", file),
        type: "file",
        label: file,
        content,
        contentHash: contentHash(content),
        provenance: {
          source: "entire-checkpoint",
          checkpointId,
          locator: `file:${file}`,
        },
        handling: "shareable",
      };
    });
    if (prompt.availability === "available" && prompt.value) {
      evidence.push({
        id: stableEvidenceId(checkpointId, "prompt", prompt.value),
        type: "prompt",
        label: "Original intent",
        content: prompt.value,
        contentHash: contentHash(prompt.value),
        provenance: {
          source: "entire-checkpoint",
          checkpointId,
          locator: "session-summary:intent",
        },
        handling: "local-only",
      });
    }

    return CheckpointEvidenceBundleSchema.parse({
      checkpoint,
      prompt,
      transcript,
      metadataPartial: Boolean(detail.partial || detail.sessions.some((session) => session.error)),
      outcome: summaries.map((summary) => summary.outcome).find((outcome) => outcome?.trim()),
      openItems: summaries.flatMap((summary) => summary.open_items ?? []),
      friction: summaries.flatMap((summary) => summary.friction ?? []),
      evidence,
    });
  }
}

class FixtureCheckpointSource implements CheckpointSource {
  readonly kind = "fixture" as const;
  readonly label: string;
  private readonly checkpoints: Map<string, CheckpointEvidenceBundle>;

  constructor(label: string, checkpoints: CheckpointEvidenceBundle[]) {
    this.label = label;
    this.checkpoints = new Map(checkpoints.map((bundle) => [bundle.checkpoint.id, bundle]));
  }

  listCheckpoints(): Promise<CheckpointSummary[]> {
    return Promise.resolve([...this.checkpoints.values()].map((bundle) => bundle.checkpoint));
  }

  getCheckpointEvidence(checkpointId: string): Promise<CheckpointEvidenceBundle> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return Promise.reject(new Error(`Checkpoint ${checkpointId} is not present in the fixture.`));
    }
    return Promise.resolve(checkpoint);
  }
}

export async function createCheckpointSource(config: AppConfig): Promise<CheckpointSource> {
  if (!config.checkpointFixturePath) {
    return new EntireCliCheckpointSource(config.repositoryRoot);
  }
  const fixturePath = resolve(config.repositoryRoot, config.checkpointFixturePath);
  const fixture = CheckpointFixtureSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));
  return new FixtureCheckpointSource(fixture.label, fixture.checkpoints);
}
