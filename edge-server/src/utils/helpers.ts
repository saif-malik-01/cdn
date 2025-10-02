import type { CacheEntry } from "../cache/CacheEntry.js";

export function convertBytesToMB(bytes: number) {
  return bytes / (1024 * 1024);
}

export function computeAge(cacheEntry: CacheEntry) {
  const storedAt = cacheEntry.expires - cacheEntry.maxAge;
  return Math.max(0, Math.floor((Date.now() - storedAt) / 1000));
}