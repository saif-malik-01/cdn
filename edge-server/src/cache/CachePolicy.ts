import  type{ CacheEntry } from "./CacheEntry.js";

export class CachePolicy {
  static isFresh(entry: CacheEntry): boolean {
    return Date.now() < entry.expires;
  }

  static isStale(entry: CacheEntry): boolean {
    return Date.now() >= entry.expires;
  }

  static canServeStaleWhileRevalidate(entry: CacheEntry): boolean {
    return Date.now() < entry.expires + entry.staleWhileRevalidate;
  }

  static canServeStaleIfError(entry: CacheEntry): boolean {
    return Date.now() < entry.expires + entry.staleIfError;
  }
}
