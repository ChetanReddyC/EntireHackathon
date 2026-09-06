# RISKS.md

Status: LIVING - active material risks only.

## R-003 - Databricks live path unavailable

Trigger: credentials, index schema, network access, or AI Search availability is missing or incompatible.

Impact: the Best Use of Databricks path cannot be demonstrated live.

Mitigation: preserve an explicit canonical local fallback, never fabricate remote hits, validate the configured path before the final demo, and retain fallback evidence.

## R-006 - Sensitive context exposure

Trigger: a future adapter bypasses the allowlisted evidence projection or changes an evidence item from `local-only` to `shareable` incorrectly.

Impact: raw prompt or transcript content could leave the machine.

Mitigation: keep the projection as the only external input builder, retain schema/runtime validation, and cover redacted, missing, and raw-secret cases with focused tests.

## R-007 - Official fixture shape mismatch

Trigger: the official redacted Checkpoint fixture differs from the representative normalized fixture in this repository.

Impact: fixture loading or completeness detection may fail during judging.

Mitigation: replace or adapt the fixture through the isolated Checkpoint source once the official file is available; do not weaken the canonical contracts.

## R-008 - AgentRouter live path unavailable

Trigger: AgentRouter credentials, base URL, model access, structured-output compatibility, or network access is unavailable.

Impact: complete checkpoints cannot demonstrate live semantic review even though deterministic evidence remains usable.

Mitigation: keep provider details server-side and isolated, surface semantic analysis as unavailable without fabricating output, retain deterministic local evidence, and validate the configured live path before the final demo.

## R-009 - Review cache unavailable or stale

Trigger: the user-local application-data directory is unwritable, a cached record is malformed, or its evidence/provider/version identity no longer matches.

Impact: analysis must run again or a validated live result cannot be persisted across restarts.

Mitigation: validate every record with Zod, require exact cache identity matches, write through a temporary file and atomic rename, and return a live validated result with an explicit persistence failure instead of claiming it was cached.

## R-010 - DeepSeek live analysis unavailable

Trigger: the configured DeepSeek account has insufficient API balance or later encounters authentication, rate-limit, model-access, or availability failures. The first live request reached DeepSeek and returned HTTP 402, which DeepSeek documents as insufficient balance.

Impact: complete checkpoints remain bounded local reviews without semantic signals or an Intent Guard score.

Mitigation: surface the provider failure explicitly, retain canonical local evidence, never fabricate model output, and retry after API credit is available.
