# CONTEXT.md

Status: LIVING - current product intent and execution context.

## Product

Checkpoint Lens is a local-first Checkpoint-native review and handoff experience for the current repository. Entire Checkpoints remain the canonical evidence source.

## Noon Curveball

The product must support sensitive repositories. Raw prompts and transcripts stay local and are never included in a Databricks or other external-service request. Redacted, unavailable, and partial fields remain useful through bounded local file, test, summary, and provenance evidence.

Incomplete context is a first-class state. It must always render as provisional, must not receive an Intent Guard score, and must tell the user what is missing and what to verify next.

## Current architecture

React UI -> Express API -> Entire CLI or explicit fixture source -> canonical evidence bundle -> privacy projection -> Databricks retrieval when configured or explicit local fallback -> deterministic local review and handoff.

Databricks may receive only evidence marked `shareable`. Every returned hit must match a canonical local evidence ID, Checkpoint ID, and content hash before use. Raw provider shapes remain inside their adapters.

## Current constraint

The official redacted attachment is not present in the workspace. A representative redacted/missing fixture is included for implementation and focused verification until the official fixture is available.
