# DECISIONS.md

Status: LIVING DECISION LOG - append meaningful decisions only.

## D-015 - Sensitive Checkpoint boundary

Raw prompt and transcript content is local-only. External services receive only an allowlisted projection of canonical evidence explicitly marked `shareable`. The projection omits the raw context fields by construction.

Incomplete Checkpoint context produces a provisional result with no score. This is enforced in the shared Zod contract so server, persistence, API, and UI cannot silently relabel an incomplete result as complete or authoritative.

## D-016 - Privacy-safe Databricks retrieval

Databricks remains the optional semantic retrieval layer, but the Curveball narrows its input to shareable structural evidence. Query hits are references only and must resolve to canonical local evidence by evidence ID, Checkpoint ID, and content hash. Missing configuration, service failure, or invalid hits falls back explicitly to local evidence.

Delta Sync is triggered through the configured index. The application does not upload prompt or transcript records during synchronization.

## D-017 - Review analysis and persistence boundary

Only complete Checkpoint context is eligible for AgentRouter analysis. The request builder accepts the privacy projection, excludes prompt/transcript evidence by both handling and type, and sends one strict structured-output request using GPT-5.6 Sol with medium reasoning. Incomplete context bypasses all external retrieval and analysis and remains provisional with no score.

Model evidence references are validated against the exact supplied canonical evidence set. Deterministic code calculates Intent Guard scores using Done = 1, Risky = 0.5, Drifted = 0.25, and Missing = 0, then builds the handoff from those validated signals.

Validated results persist atomically in a user-local filesystem cache outside the repository. The cache identity includes repository/checkpoint identity, evidence hash, schema/prompt versions, and provider configuration; re-analysis bypasses the stored result.

## D-018 - DeepSeek provider selection

When `DEEPSEEK_API_KEY` is configured, DeepSeek is the primary semantic-analysis provider; AgentRouter remains the secondary configured option. DeepSeek uses its OpenAI-compatible Chat Completions endpoint and JSON-object mode, followed by the same Zod and canonical evidence-reference validation as every provider.

Provider output remains non-authoritative: deterministic application code owns scoring and handoff construction. Provider identity, model, reasoning mode, output mode, and prompt version participate in cache invalidation.
