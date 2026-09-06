import { CircleDashed, GitCommitHorizontal, ShieldAlert, ShieldCheck } from "lucide-react";

import type { CheckpointSummary } from "../../shared/contracts";

type DecisionTimelineProps = {
  checkpoints: CheckpointSummary[];
  selectedId?: string;
  sourceLabel: string;
  onSelect(checkpointId: string): void;
};

function formatCheckpointDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DecisionTimeline({ checkpoints, selectedId, sourceLabel, onSelect }: DecisionTimelineProps) {
  return (
    <section className="timeline" aria-labelledby="timeline-heading">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Current branch</p>
          <h1 id="timeline-heading">Decision timeline</h1>
        </div>
        <span className="count-badge">
          {checkpoints.length} checkpoint{checkpoints.length === 1 ? "" : "s"}
        </span>
      </header>

      <p className="source-label">{sourceLabel}</p>

      {checkpoints.length === 0 ? (
        <div className="empty-timeline">
          <div className="timeline-rail" aria-hidden="true">
            <span className="timeline-node">
              <GitCommitHorizontal size={18} strokeWidth={1.8} />
            </span>
          </div>
          <div>
            <h2>No checkpoints available</h2>
            <p>The current repository has no committed Checkpoint history to review.</p>
            <span className="pending-state">
              <CircleDashed size={15} />
              Local repository connected
            </span>
          </div>
        </div>
      ) : (
        <ol className="checkpoint-list">
          {checkpoints.map((checkpoint) => {
            const incomplete = checkpoint.contextCompleteness === "incomplete";
            const complete = checkpoint.contextCompleteness === "complete";
            return (
              <li key={checkpoint.id}>
                <button
                  className={`checkpoint-button${selectedId === checkpoint.id ? " selected" : ""}`}
                  type="button"
                  onClick={() => onSelect(checkpoint.id)}
                  aria-pressed={selectedId === checkpoint.id}
                >
                  <span className="checkpoint-node" aria-hidden="true">
                    <GitCommitHorizontal size={17} />
                  </span>
                  <span className="checkpoint-copy">
                    <span className="checkpoint-title">{checkpoint.title}</span>
                    <span className="checkpoint-meta">
                      {formatCheckpointDate(checkpoint.createdAt)}
                      {checkpoint.agent ? ` - ${checkpoint.agent}` : ""}
                    </span>
                  </span>
                  <span
                    className={`context-badge ${incomplete ? "incomplete" : complete ? "complete" : "unknown"}`}
                  >
                    {incomplete ? <ShieldAlert size={14} /> : complete ? <ShieldCheck size={14} /> : <CircleDashed size={14} />}
                    {incomplete ? "Incomplete" : complete ? "Complete" : "Not assessed"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
