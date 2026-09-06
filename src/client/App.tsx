import { useEffect, useState } from "react";
import { GitBranch, RefreshCw, ShieldCheck } from "lucide-react";

import type { BootstrapResponse } from "../shared/contracts";
import { loadBootstrap } from "./api";
import { DecisionTimeline } from "./components/DecisionTimeline";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: BootstrapResponse }
  | { status: "error"; message: string };

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: "loading" });

    loadBootstrap(controller.signal)
      .then((data) => setLoadState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : "Repository context could not be loaded.";
          setLoadState({ status: "error", message });
        }
      });

    return () => controller.abort();
  }, [loadAttempt]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <span>Checkpoint Lens</span>
        </div>
        <div className="repo-summary">
          <GitBranch size={16} aria-hidden="true" />
          <span>{loadState.status === "ready" ? loadState.data.repository.name : "Repository"}</span>
          <span className={`connection-dot ${loadState.status}`} aria-hidden="true" />
        </div>
      </header>

      <main className="workspace">
        {loadState.status === "loading" && (
          <div className="center-state" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>Loading repository context</p>
          </div>
        )}

        {loadState.status === "error" && (
          <div className="center-state error-state" role="alert">
            <h1>Repository unavailable</h1>
            <p>{loadState.message}</p>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              <RefreshCw size={16} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {loadState.status === "ready" && (
          <div className="product-grid">
            <DecisionTimeline />
            <aside className="review-pane" aria-labelledby="review-heading">
              <div className="review-empty">
                <span className="review-icon" aria-hidden="true">
                  <ShieldCheck size={22} />
                </span>
                <p className="eyebrow">Change review</p>
                <h2 id="review-heading">Select a checkpoint</h2>
                <p>Intent signals, supporting evidence, and handoff context will appear here.</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
