import type { POP } from "./types.js";

export default function pickBestPop(candidatePops: POP[]) {
  if (!candidatePops || !candidatePops.length) return null;
  const withLatency = candidatePops.filter((c) => c.latency_ms != null);
  if (withLatency.length) {
    withLatency.sort((a, b) => a.latency_ms - b.latency_ms);
    return withLatency[0];
  }
  return candidatePops[Math.floor(Math.random() * candidatePops.length)];
}
