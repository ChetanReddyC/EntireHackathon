import { AlertTriangle, CheckCircle2, FileCode2, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import type { ReviewResult } from "../../shared/contracts";

type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReviewResult };

type ReviewPaneProps = {
  state: ReviewState;
};

export function ReviewPane({ state }: ReviewPaneProps) {
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
        <p>Building a local evidence review</p>
      </aside>
    );
  }

  if (state.status === "error") {
    return (
      <aside className="review-pane review-centered" role="alert">
        <AlertTriangle size={25} aria-hidden="true" />
        <h2>Review unavailable</h2>
        <p>{state.message}</p>
      </aside>
    );
  }

  const review = state.data;
  const incomplete = review.contextCompleteness === "incomplete";

  return (
    <aside className="review-pane" aria-labelledby="review-heading">
      <header className="review-header">
        <div>
          <p className="eyebrow">Change review</p>
          <h2 id="review-heading">Local evidence review</h2>
        </div>
        <span className={`context-badge ${incomplete ? "incomplete" : "complete"}`}>
          {incomplete ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {incomplete ? "Incomplete context" : "Complete context"}
        </span>
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

      <p className="review-summary">{review.summary}</p>

      <p className={`retrieval-status ${review.retrieval.status}`}>
        <strong>
          {review.retrieval.source === "databricks" ? "Databricks evidence" : "Local evidence fallback"}
        </strong>
        <span>{review.retrieval.notice}</span>
      </p>

      <div className="review-metrics" aria-label="Review status">
        <div>
          <span>Intent score</span>
          <strong>{review.score === null ? "Not scored" : `${review.score}%`}</strong>
        </div>
        <div>
          <span>Processing</span>
          <strong className="local-only"><LockKeyhole size={14} /> Local only</strong>
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
        <h3>Intent Guard</h3>
        {review.signals.length === 0 ? (
          <p>No deterministic risk signal was produced.</p>
        ) : (
          review.signals.map((signal) => (
            <div className="signal-row" key={signal.id}>
              <span className="signal-status">{signal.status}</span>
              <div>
                <strong>{signal.title}</strong>
                <p>{signal.rationale}</p>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="review-section">
        <h3>Available local evidence</h3>
        <ul className="evidence-list">
          {review.evidence.map((evidence) => (
            <li key={evidence.id}>
              <FileCode2 size={15} aria-hidden="true" />
              <span>
                <strong>{evidence.label}</strong>
                <small>{evidence.content}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="review-section handoff-section">
        <h3>Continue / Handoff</h3>
        <dl>
          <dt>Original intent</dt>
          <dd>{review.handoff.originalIntent}</dd>
          <dt>Completed work</dt>
          <dd>{review.handoff.completedWork}</dd>
          <dt>Next step</dt>
          <dd>{review.handoff.nextStep}</dd>
        </dl>
      </section>
    </aside>
  );
}

export type { ReviewState };
