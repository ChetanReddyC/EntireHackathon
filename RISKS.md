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
