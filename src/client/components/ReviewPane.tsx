import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  FileCode2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type { Evidence, ReviewResult } from "../../shared/contracts";

type ReviewState =
  | { status: "idle" }
  | { status: "loading"; action: "load" | "reanalyze" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReviewResult };

type ReviewPaneProps = {
  state: ReviewState;
  onRetry(): void;
  onReanalyze(): void;
};

type CopyState = "idle" | "copied" | "failed";

function evidenceTypeLabel(evidence: Evidence): string {
  return evidence.type.replace("-", " ");
}

function buildHandoffText(review: ReviewResult): string {
  const heading = review.authority === "provisional"
    ? "PROVISIONAL HANDOFF - INCOMPLETE CONTEXT"
    : "CHECKPOINT HANDOFF";
  const section = (label: string, items: string[]) =>
    `${label}\n${items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None recorded"}`;

  return [
    heading,
    `\nOriginal intent\n${review.handoff.originalIntent}`,
    `\nCompleted work\n${review.handoff.completedWork}`,
    `\n${section("Missing work", review.handoff.missingWork)}`,
    `\n${section("Risks", review.handoff.risks)}`,
    `\nNext step\n${review.handoff.nextStep}`,
  ].join("\n");
}

function EvidenceDetails({ evidence }: { evidence: Evidence }) {
  return (
    <div className="evidence-details">
      <p>{evidence.content}</p>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{evidenceTypeLabel(evidence)}</dd>
        </div>
        <div>
          <dt>Handling</dt>
          <dd>{evidence.handling === "shareable" ? "Allowlisted" : "Local only"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{evidence.provenance.locator}</dd>
        </div>
        <div>
          <dt>Integrity</dt>
          <dd title={evidence.contentHash}>{evidence.contentHash.slice(0, 12)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ReviewPane({ state, onRetry, onReanalyze }: ReviewPaneProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const checkpointId = state.status === "ready" ? state.data.checkpointId : undefined;

  useEffect(() => setCopyState("idle"), [checkpointId]);

  if (state.status === "idle") {
    return (
      <aside className="review-pane review-centered" aria-labelledby="review-heading">
        <div className="review-empty">
          <span className="review-icon" aria-hidden="true">
            <ShieldCheck size={22} />
          </span>
          <p className="eyebrow">Change review</p>
          <h2 id="review-heading">Select a checkpoint</h2>
          <p>Intent signals, supporting evidence, and handoff context will appear here.</p>
        </div>
      </aside>
    );
  }

  if (state.status === "loading") {
    return (
      <aside className="review-pane review-centered" aria-live="polite">
        <LoaderCircle className="loading-icon" size={24} aria-hidden="true" />
        <h2>{state.action === "reanalyze" ? "Re-analyzing checkpoint" : "Loading checkpoint review"}</h2>
        <p>
          {state.action === "reanalyze"
            ? "Validating allowlisted evidence and rebuilding the review."
            : "Reading local Checkpoint evidence and context availability."}
        </p>
      </aside>
    );
  }

  if (state.status === "error") {
    return (
      <aside className="review-pane review-centered" role="alert">
        <AlertTriangle size={25} aria-hidden="true" />
        <h2>Review unavailable</h2>
        <p>{state.message}</p>
        <button type="button" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Retry review
        </button>
      </aside>
    );
  }

  const review = state.data;
  const incomplete = review.contextCompleteness === "incomplete";
  const semanticUnavailable = !incomplete && review.analysis.status === "unavailable";
  const externallyAnalyzed = review.privacy.processing === "external-allowlisted";
  const evidenceById = new Map(review.evidence.map((evidence) => [evidence.id, evidence]));

  async function copyHandoff() {
    try {
      await navigator.clipboard.writeText(buildHandoffText(review));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <aside className="review-pane" aria-labelledby="review-heading">
      <header className="review-header">
        <div>
          <p className="eyebrow">Change review</p>
          <h2 id="review-heading">
            {review.analysis.status === "complete" ? "Semantic checkpoint review" : "Local evidence review"}
          </h2>
        </div>
        <div className="review-header-actions">
          {!incomplete && (
            <button className="secondary-button" type="button" onClick={onReanalyze}>
              <RefreshCw size={15} aria-hidden="true" />
              {semanticUnavailable ? "Retry analysis" : "Re-analyze"}
            </button>
          )}
          <span className={`context-badge ${incomplete ? "incomplete" : "complete"}`}>
            {incomplete ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {incomplete ? "Incomplete context" : "Complete context"}
          </span>
        </div>
      </header>

      {incomplete && (
        <div className="context-warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Provisional result</strong>
            <p>Context gaps prevent an authoritative intent judgment. No score is shown.</p>
          </div>
        </div>
      )}

      {semanticUnavailable && (
        <div className="context-warning analysis-warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Semantic analysis unavailable</strong>
            <p>{review.analysis.notice}</p>
          </div>
        </div>
      )}

      <p className="review-summary">{review.summary}</p>

      <p className={`retrieval-status ${review.retrieval.status}`}>
        <strong>
          {review.retrieval.source === "databricks" ? "Databricks evidence" : "Local evidence fallback"}
        </strong>
        <span>{review.retrieval.notice}</span>
      </p>

      {review.analysis.status === "complete" && (
        <p className="analysis-status">
          <strong>{review.analysis.cache === "hit" ? "Cached analysis" : "Fresh analysis"}</strong>
          <span>{review.analysis.notice}</span>
        </p>
      )}

      <div className="review-metrics" aria-label="Review status">
        <div>
          <span>Intent score</span>
          <strong>{review.score === null ? "Not scored" : `${review.score}%`}</strong>
        </div>
        <div>
          <span>Analysis input</span>
          <strong className="local-only">
            {externallyAnalyzed ? <ShieldCheck size={14} /> : <LockKeyhole size={14} />}
            {externallyAnalyzed ? "Allowlisted only" : "Local only"}
          </strong>
        </div>
        <div>
          <span>Review cache</span>
          <strong>
            <Database size={14} />
            {review.analysis.cache === "hit"
              ? "Local hit"
              : review.analysis.persistence === "stored"
                ? "Stored"
                : "Not stored"}
          </strong>
        </div>
      </div>

      {review.limitations.length > 0 && (
        <section className="review-section">
          <h3>Context gaps</h3>
          <ul className="plain-list">
            {review.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="review-section">
        <div className="section-title-row">
          <h3>Intent Guard</h3>
          <span>{review.signals.length} signal{review.signals.length === 1 ? "" : "s"}</span>
        </div>
        {review.signals.length === 0 ? (
          <p className="section-empty">No supported intent signal is available for this review.</p>
        ) : (
          <div className="signal-list">
            {review.signals.map((signal) => {
              const references = signal.evidenceIds.flatMap((id) => {
                const evidence = evidenceById.get(id);
                return evidence ? [evidence] : [];
              });
              return (
                <details className="signal-disclosure" key={signal.id}>
                  <summary>
                    <span className={`signal-status ${signal.status.toLowerCase()}`}>{signal.status}</span>
                    <span className="signal-copy">
                      <strong>{signal.title}</strong>
                      <small>{signal.confidence === "supported" ? "Evidence supported" : "Limited evidence"}</small>
                    </span>
                    <ChevronDown className="disclosure-icon" size={16} aria-hidden="true" />
                  </summary>
                  <div className="signal-details">
                    <p>{signal.rationale}</p>
                    <strong className="detail-label">Why this signal</strong>
                    {references.length > 0 ? (
                      <div className="signal-evidence">
                        {references.map((evidence) => (
                          <div key={evidence.id}>
                            <span><FileCode2 size={14} aria-hidden="true" />{evidence.label}</span>
                            <p>{evidence.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="section-empty">No evidence reference was available for this missing signal.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="review-section">
        <div className="section-title-row">
          <h3>Available local evidence</h3>
          <span>{review.evidence.length} item{review.evidence.length === 1 ? "" : "s"}</span>
        </div>
        {review.evidence.length === 0 ? (
          <p className="section-empty">No canonical evidence was recorded for this checkpoint.</p>
        ) : (
          <div className="evidence-list">
            {review.evidence.map((evidence) => (
              <details key={evidence.id}>
                <summary>
                  <FileCode2 size={15} aria-hidden="true" />
                  <span>
                    <strong>{evidence.label}</strong>
                    <small>{evidence.handling === "shareable" ? "Allowlisted evidence" : "Local-only evidence"}</small>
                  </span>
                  <ChevronDown className="disclosure-icon" size={16} aria-hidden="true" />
                </summary>
                <EvidenceDetails evidence={evidence} />
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="review-section handoff-section">
        <div className="section-title-row">
          <h3>Continue / Handoff</h3>
          <button className="icon-text-button" type="button" onClick={copyHandoff}>
            {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
            {copyState === "copied" ? "Copied" : "Copy handoff"}
          </button>
        </div>
        {copyState === "failed" && <p className="copy-error" role="alert">Clipboard access failed.</p>}
        <dl className="handoff-summary">
          <div>
            <dt>Original intent</dt>
            <dd>{review.handoff.originalIntent}</dd>
          </div>
          <div>
            <dt>Completed work</dt>
            <dd>{review.handoff.completedWork}</dd>
          </div>
          <div>
            <dt>Missing work</dt>
            <dd>
              {review.handoff.missingWork.length > 0 ? (
                <ul>{review.handoff.missingWork.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : "None recorded."}
            </dd>
          </div>
          <div>
            <dt>Risks</dt>
            <dd>
              {review.handoff.risks.length > 0 ? (
                <ul>{review.handoff.risks.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : "None recorded."}
            </dd>
          </div>
          <div className="next-step">
            <dt>Next step</dt>
            <dd>{review.handoff.nextStep}</dd>
          </div>
        </dl>
        <p className="privacy-footnote">
          <LockKeyhole size={13} aria-hidden="true" />
          Prompt and transcript remain excluded from external evidence.
        </p>
      </section>
    </aside>
  );
}

export type { ReviewState };
