//value = { size, expires, etag, path, source, headers }

class LRUCache {
  constructor(limit = 100) {
    this.limit = limit;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.limit) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, value);
  }

  delete(key) {
    this.cache.delete(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }
}

const memoCache = new LRUCache(1000);

export function getCache(key) {
  return memoCache.get(key);
}

export function setCache(key, value) {
  memoCache.set(key, value);
}

export function deleteCache(key) {
  memoCache.delete(key);
}