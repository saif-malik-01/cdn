import type { CacheMeta } from "../types.js";

class LRUCache {
  limit;
  cache;

  constructor(limit = 100) {
    this.limit = limit;
    this.cache = new Map();
  }

  get(key: string) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: CacheMeta) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.limit) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, value);
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  has(key: string) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }
}

const memoCache = new LRUCache(1000);

export function getCache(key: string) {
  return memoCache.get(key);
}

export function setCache(key: string, value: Omit<CacheMeta, "createdAt">) {
  memoCache.set(key, { ...value, createdAt: Date.now() });
}

export function deleteCache(key: string) {
  memoCache.delete(key);
}
