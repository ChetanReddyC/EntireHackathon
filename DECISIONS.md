# DECISIONS.md

Status: LIVING DECISION LOG - append meaningful decisions only.

## D-015 - Sensitive Checkpoint boundary

Raw prompt and transcript content is local-only. External services receive only an allowlisted projection of canonical evidence explicitly marked `shareable`. The projection omits the raw context fields by construction.

Incomplete Checkpoint context produces a provisional result with no score. This is enforced in the shared Zod contract so server, persistence, API, and UI cannot silently relabel an incomplete result as complete or authoritative.

## D-016 - Privacy-safe Databricks retrieval

Databricks remains the optional semantic retrieval layer, but the Curveball narrows its input to shareable structural evidence. Query hits are references only and must resolve to canonical local evidence by evidence ID, Checkpoint ID, and content hash. Missing configuration, service failure, or invalid hits falls back explicitly to local evidence.

Delta Sync is triggered through the configured index. The application does not upload prompt or transcript records during synchronization.
