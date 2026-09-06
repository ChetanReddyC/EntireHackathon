import { CircleDashed, GitCommitHorizontal } from "lucide-react";

export function DecisionTimeline() {
  return (
    <section className="timeline" aria-labelledby="timeline-heading">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Current branch</p>
          <h1 id="timeline-heading">Decision timeline</h1>
        </div>
        <span className="count-badge">0 checkpoints</span>
      </header>

      <div className="empty-timeline">
        <div className="timeline-rail" aria-hidden="true">
          <span className="timeline-node">
            <GitCommitHorizontal size={18} strokeWidth={1.8} />
          </span>
        </div>
        <div>
          <h2>No checkpoints loaded</h2>
          <p>The repository is connected. Checkpoint ingestion is not available yet.</p>
          <span className="pending-state">
            <CircleDashed size={15} />
            Waiting for checkpoint source
          </span>
        </div>
      </div>
    </section>
  );
}
