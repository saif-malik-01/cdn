import { CONFIG } from "../config.js";
import { RequestParser } from "../http/RequestParser.js";
import { StorageStrategy } from "../storage/StorageStrategy.js";
import type { SourceType } from "../types.js";
import { convertBytesToMB } from "../utils/helpers.js";
import type { CacheEntry } from "./CacheEntry.js";
import { LRUCache } from "./LRUCache.js";

export class CacheManager {
  private static index = new LRUCache<string, CacheEntry>(CONFIG.cacheLimit);

  static async get(key: string): Promise<CacheEntry | null> {
    return this.index.get(key) || null;
  }

  static async set(key: string, entry: Response): Promise<Buffer | null> {
    console.log(key);

    const headers = entry.headers;

    const contentLengthMB = convertBytesToMB(
      Number(headers.get("content-length"))
    );

    const body = Buffer.from(await entry.arrayBuffer());

    if (contentLengthMB > CONFIG.cacheFileLimitMB) {
      return body;
    }

    const storage = StorageStrategy.decide(contentLengthMB);

    let path = "";
    if (entry.status == 200) {
      path = await storage.save(key, body);
    }

    let source: SourceType = "memory";
    if (contentLengthMB > CONFIG.memoryThresholdMB) {
      source = "disk";
    }

    const cc = RequestParser.parseCacheControl(headers.get("Cache-Control"));

    let maxAge = cc.maxAge;
    if (!maxAge) {
      maxAge = Date.parse(headers.get("Expires") || "") - Date.now();
      if (isNaN(maxAge) || maxAge < 0) maxAge = 0;
    }

    const cache: CacheEntry = {
      key,
      headers,
      path,
      source,
      maxAge,
      size: Number(headers.get("content-length")),
      expires: Date.now() + maxAge,
      lastModified: headers.get("last-modified") || "",
      etag: headers.get("etag") || "",
      staleWhileRevalidate: cc.staleWhileRevalidate || 0,
      staleIfError: cc.staleIfError || 0,
    };

    if (entry.status == 304) {
      const filterCache: Partial<CacheEntry> = { ...cache };
      delete filterCache.path;
      delete filterCache.source;
      this.update(key, filterCache);
      return null;
    }

    const evictionKey = this.index.set(key, cache);
    if (evictionKey) {
      storage.delete(evictionKey);
    }
    return body;
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
