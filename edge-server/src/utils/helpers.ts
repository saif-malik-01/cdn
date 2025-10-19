import type { Agent } from "undici";
import fs from "node:fs";
import path from "path";
import type { CacheEntry } from "../cache/CacheEntry.js";

export function convertBytesToMB(bytes: number) {
  return bytes / (1024 * 1024);
}

export function computeAge(cacheEntry: CacheEntry) {
  const storedAt = cacheEntry.expires - cacheEntry.maxAge;
  return Math.max(0, Math.floor((Date.now() - storedAt) / 1000));
}

export function computeActiveRequests(agent: Agent): number {
  const statsByOrigin = agent.stats;
  let totalActive = 0;
  for (const stats of Object.values(statsByOrigin)) {
    totalActive += stats.running ?? 0;
  }
  return totalActive;
}

export function serializeHeaders(headers: Headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, String(v)])
  );
}

export function deleteTempFiles(dir: string) {
  fs.readdir(dir, (err, files) => {
    if (err) throw err;
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) throw err;
        if (stats.isDirectory()) {
          deleteTempFiles(filePath);
        } else if (file.startsWith(".temp")) {
          fs.unlink(filePath, (err) => {
            if (err) throw err;
          });
        }
      });
    });
  });
}
