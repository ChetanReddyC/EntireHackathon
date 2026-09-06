# PROGRESS.md

Status: LIVING - exact implementation state and next task only.

## Current phase

Noon Curveball adaptation through Task 3 is implemented and focused verification has passed in the official Entire mirror clone.

## Completed

- Cloned `ChetanReddyC/cli` through the Entire mirror in the India region.
- Enabled Entire project tracking and installed Codex hooks in the clone.
- IMPLEMENTED / VERIFIED: Task 1 React/Vite + Express/TypeScript bootstrap.
- Added one-command development scripts, shared Zod bootstrap contracts, environment configuration, repository-context resolution, thin API/runtime files, and the initial responsive dashboard shell.
- Installed locked npm dependencies and generated `package-lock.json`.
- Installed Entire Graph v0.4.0, initialized its repository agent guide, and ran the required pre-change search and impact analysis.
- IMPLEMENTED / VERIFIED: sensitive-repository privacy boundary across Checkpoint ingestion, canonical contracts, deterministic local review/handoff, API, and React presentation.
- Raw transcript bytes remain inside the local Entire adapter and are never included in the external evidence projection. Prompt and transcript evidence are marked local-only.
- Incomplete context is schema-enforced as provisional with no Intent Guard score; the UI labels complete, incomplete, and not-assessed states separately.
- Added a deterministic redacted/missing Checkpoint fixture and focused privacy-boundary tests.
- IMPLEMENTED / BUILD-VERIFIED: Task 3 canonical evidence provenance and privacy-safe retrieval boundary.
- Evidence now carries deterministic IDs, content hashes, and Entire Checkpoint provenance.
- Added a narrow Databricks AI Search adapter with Delta Sync trigger, metadata-only query construction, canonical hit validation, and explicit local fallback.
- Added live `CONTEXT.md`, `DECISIONS.md`, and `RISKS.md` repository records for the Curveball architecture and remaining risks.

## Verification status

- `vitest`: passed 2 focused privacy tests, including redacted/missing Checkpoint data and external-projection filtering.
- Vite client production build: passed.
- TypeScript server build: passed.
- Dependency audit: 0 vulnerabilities.
- `mise run check`: attempted, but the upstream Go suite is not cleanly runnable in this Windows environment (`-race` requires CGO, `shellcheck` is unavailable, schema download timed out, and two existing Windows Go lint findings remain). The formatter-only Go churn from that attempt was removed; this slice contains no Go changes.

## Next task

Implement Section 16 Task 4: the on-demand semantic Review Engine, deterministic Intent Guard scoring for complete context, evidence-reference validation, and filesystem `ReviewStore` caching. Preserve the local provisional path for incomplete context and do not send raw prompts or transcripts to the analysis provider.

## Current blockers and constraints

- The supplied attachment was not present in the workspace, so the implementation uses a representative redacted/missing Checkpoint fixture pending replacement with the official fixture if its shape differs.
- Live Databricks retrieval still requires configured workspace credentials and index data for end-to-end verification; the local fallback is active without them.
