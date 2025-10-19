import { CONFIG } from "../config.js";
import { RequestParser } from "../http/RequestParser.js";
import { getCacheDir } from "../libs/cacheFS.js";
import { serializeHeaders } from "../libs/parser.js";
import { StorageStrategy } from "../storage/StorageStrategy.js";
import type { SourceType } from "../types.js";
import { convertBytesToMB } from "../utils/helpers.js";
import type { CacheEntry } from "./CacheEntry.js";
import { LRUCache } from "./LRUCache.js";
import fs from "node:fs";
import path from "path";

const cacheDir = getCacheDir();
const PERSIST_PATH = path.resolve(cacheDir, "index.json");

export class CacheManager {
  private static index = new LRUCache<string, CacheEntry>(CONFIG.cacheLimit);
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const data = await fs.promises.readFile(PERSIST_PATH, "utf8");
      const entries: CacheEntry[] = JSON.parse(data);
      for (const entry of entries) {
        this.index.set(entry.key, entry);
      }
      console.log(`[CacheManager] Restored ${entries.length} cache entries`);
    } catch (err) {
      console.warn(
        "[CacheManager] No persistent cache found or failed to read."
      );
    }
    this.initialized = true;
  }

  private static async persistIndex(): Promise<void> {
    const entries = Array.from(this.index.values()).filter(
      (i) => i.source !== "memory"
    );
    try {
      await fs.promises.writeFile(
        PERSIST_PATH,
        JSON.stringify(entries, null, 2),
        "utf8"
      );
    } catch (err) {
      console.error("[CacheManager] Failed to persist cache index:", err);
    }
  }

  static async get(key: string): Promise<CacheEntry | null> {
    const entry = this.index.get(key) || null;
    this.persistIndex();
    return entry;
  }

  static async set(key: string, entry: Response): Promise<Buffer | null> {
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
      headers: serializeHeaders(headers),
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

    const evictionEntry = this.index.set(key, cache);
    if (evictionEntry) {
      const envictionStorage = StorageStrategy.decide(
        convertBytesToMB(evictionEntry.size)
      );
      envictionStorage.delete(evictionEntry.key);
    }

    await this.persistIndex();
    return body;
  }

  static async invalidate(key: string): Promise<void> {
    this.index.delete(key);
    this.persistIndex();
  }

  static async update(key: string, entry: Partial<CacheEntry>): Promise<void> {
    const existing = this.index.get(key);
    if (existing) {
      this.index.set(key, { ...existing, ...entry });
    }
    this.persistIndex();
  }
}
