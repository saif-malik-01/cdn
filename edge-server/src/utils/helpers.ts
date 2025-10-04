import type { Agent } from "undici";
import type { CacheEntry } from "../cache/CacheEntry.js";

export function convertBytesToMB(bytes: number) {
  return bytes / (1024 * 1024);
}

export function computeAge(cacheEntry: CacheEntry) {
  const storedAt = cacheEntry.expires - cacheEntry.maxAge;
  return Math.max(0, Math.floor((Date.now() - storedAt) / 1000));
}

export function getActiveRequests(agent: Agent): number {
  const statsByOrigin = agent.stats;
  let totalActive = 0;

  for (const stats of Object.values(statsByOrigin)) {
    totalActive += stats.running ?? 0;
  }

  return totalActive;
}
