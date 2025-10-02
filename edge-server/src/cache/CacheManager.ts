import type { CacheEntry } from "./CacheEntry.js";
import { LRUCache } from "./LRUCache.js";

export class CacheManager {
  private static index = new LRUCache<string, CacheEntry>(1000);

  static async get(key: string): Promise<CacheEntry | null> {
    return this.index.get(key) || null;
  }

  static async set(key: string, entry: CacheEntry): Promise<void> {
    this.index.set(key, entry);
  }

  static async invalidate(key: string): Promise<void> {
    this.index.delete(key);
  }

  static async update(key: string, entry: Partial<CacheEntry>): Promise<void> {
    const existing = this.index.get(key);
    if (existing) {
      this.index.set(key, { ...existing, ...entry });
    }
  }
}
