# PROGRESS.md

Status: LIVING - exact implementation state and next task only.

## Current phase

Noon Curveball adaptation through Task 5 is implemented and focused verification is passing.

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
- Added four deterministic demo Checkpoints covering complete, redacted-prompt, unavailable-transcript, and partial-metadata states.
- IMPLEMENTED / BUILD-VERIFIED: Task 3 canonical evidence provenance and privacy-safe retrieval boundary.
- Evidence now carries deterministic IDs, content hashes, and Entire Checkpoint provenance.
- Added a narrow Databricks AI Search adapter with Delta Sync trigger, metadata-only query construction, canonical hit validation, and explicit local fallback.
- Added live `CONTEXT.md`, `DECISIONS.md`, and `RISKS.md` repository records for the Curveball architecture and remaining risks.
- IMPLEMENTED / VERIFIED: Task 4 on-demand Review Engine, AgentRouter adapter, evidence-reference validation, deterministic Intent Guard scoring, and filesystem ReviewStore caching.
- Incomplete context bypasses Databricks and AgentRouter entirely; complete analysis receives only allowlisted non-prompt/non-transcript evidence.
- Added cache identity/version invalidation, atomic user-local persistence, explicit re-analysis bypass, and persistence/analysis/cache status in the shared result and UI.
- Added focused orchestration coverage for redacted bypass, raw-context exclusion, deterministic scoring, durable cache reuse, and rejection of invented evidence references.
- IMPLEMENTED / VERIFIED: Task 5 review interactions and complete Continue / Handoff presentation.
- The latest checkpoint is selected automatically; complete checkpoints expose retry/re-analysis, while incomplete checkpoints remain non-actionable, provisional, and unscored.
- Intent signals and canonical evidence now expand into rationale, provenance, handling, and integrity details; handoffs include complete missing-work and risk lists plus local clipboard export.
- Added explicit review loading, re-analysis, retry, empty-evidence, empty-signal, and API-error states.
- IMPLEMENTED / LOCALLY VERIFIED: DeepSeek is now a first-class semantic provider using server-only credentials, JSON-object output, Zod validation, canonical evidence references, and deterministic scoring/handoff.

## Verification status

- `vitest`: passed 6 focused provider, privacy, and orchestration tests, including DeepSeek request shape, all four demo fixtures, redacted bypass, deterministic scoring, durable caching, and external-projection filtering.
- Vite client production build: passed.
- TypeScript server build: passed.
- Dependency audit: 0 vulnerabilities.
- `mise run check`: attempted, but the upstream Go suite is not cleanly runnable in this Windows environment (`-race` requires CGO, `shellcheck` is unavailable, schema download timed out, and two existing Windows Go lint findings remain). The formatter-only Go churn from that attempt was removed; this slice contains no Go changes.
- Task 4 focused tests, Vite client production build, and TypeScript server build passed.
- Task 5 passed focused regression tests, Vite production build, TypeScript server build, desktop browser rendering, four-checkpoint selection, evidence expansion, and complete/incomplete action-state checks.

## Next task

No numbered implementation task remains. Next, add DeepSeek API credit, configure the three Databricks values, complete both live-provider checks, then run final responsive demo QA and commit the completed slice.

## Current blockers and constraints

- The supplied attachment was not present in the workspace, so the implementation uses a representative redacted/missing Checkpoint fixture pending replacement with the official fixture if its shape differs.
- Live Databricks retrieval still requires configured workspace credentials and index data for end-to-end verification; the local fallback is active without them.
- DeepSeek routing is configured and reached the live API, but DeepSeek returned HTTP 402 (insufficient balance); the local evidence path remains active.
