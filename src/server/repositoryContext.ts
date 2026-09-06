import { createHash } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import type { RepositoryContext } from "../shared/contracts.js";

export async function resolveRepositoryContext(root: string): Promise<RepositoryContext> {
  const resolvedRoot = await realpath(root);
  const gitEntry = await stat(join(resolvedRoot, ".git"));

  if (!gitEntry.isDirectory() && !gitEntry.isFile()) {
    throw new Error("Repository root does not contain a usable .git entry.");
  }

  return {
    id: createHash("sha256").update(resolvedRoot).digest("hex").slice(0, 16),
    name: basename(resolvedRoot),
    root: resolvedRoot,
  };
}
