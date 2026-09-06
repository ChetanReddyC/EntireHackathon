import type { IntentSignal } from "../shared/contracts.js";

const SIGNAL_WEIGHTS: Record<IntentSignal["status"], number> = {
  Done: 1,
  Risky: 0.5,
  Drifted: 0.25,
  Missing: 0,
};

export function calculateIntentGuardScore(signals: IntentSignal[]): number | null {
  if (signals.length === 0) {
    return null;
  }
  const earnedWeight = signals.reduce((total, signal) => total + SIGNAL_WEIGHTS[signal.status], 0);
  return Math.round((earnedWeight / signals.length) * 100);
}
