import * as fs from "node:fs";
import http2 from "http2";

import computeCacheKey from "./libs/cacheKey.js";
import {
  serializeHeaders,
  parseRequest,
  parseCacheControl,
} from "./libs/parser.js";
import { validateMethod } from "./libs/validate.js";
import { getCache, setCache } from "./cache/LRUCache.js";
import { convertBytesToMegabytes } from "./libs/utils.js";
import memoryStorage from "./storage/MemoryStorage.js";
import diskStorage from "./storage/DiskStorage.js";
import type { SourceType } from "./types.js";

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
  allowHTTP1: true,
};

const server = http2.createSecureServer(options);

// Helper: compute Age
function computeAge(cacheEntry: any, maxAge: number) {
  const storedAt = cacheEntry.expires - maxAge;
  return Math.max(0, Math.floor((Date.now() - storedAt) / 1000));
}

// Helper: load body from memory/disk
async function loadCachedBody(cache: any, cacheKey: string) {
  return cache.source === "memory"
    ? await memoryStorage.get(cacheKey)
    : await diskStorage.get(cacheKey);
}

server.on("stream", async (stream, headers) => {
  const reqMeta = parseRequest(headers);
  const cacheKey = computeCacheKey(reqMeta);

  // Only allow GET/HEAD
  if (validateMethod(reqMeta.method)) {
    stream.respond({
      ":status": 405,
      "content-type": headers["content-type"],
      allow: "GET, HEAD",
    });
    stream.end(`405 Method ${reqMeta.method} Not Allowed`);
    return;
  }

  let cache = getCache(cacheKey);

  // ------------------------
  // MISS: fetch from origin
  // ------------------------
  if (!cache) {
    const originResponse = await fetch("http://localhost:3001/html");
    const originHeaders = originResponse.headers;
    const originBody = Buffer.from(await originResponse.arrayBuffer());

    // Respect no-store
    if (originHeaders.get("Cache-Control")?.includes("no-store")) {
      stream.respond({
        ":status": 200,
        ...serializeHeaders(originHeaders),
        "cache-status": "local; bypass",
        age: "0",
      });
      stream.end(originBody);
      return;
    }

    const contentLengthMB = convertBytesToMegabytes(
      Number(originHeaders.get("content-length"))
    );

    let storePath = "";
    let source: SourceType = "memory";

    if (contentLengthMB > 1) {
      storePath = await diskStorage.save(cacheKey, originBody);
      source = "disk";
    } else {
      storePath = await memoryStorage.save(cacheKey, originBody);
    }

    const cc = parseCacheControl(originHeaders.get("Cache-Control"));
    let maxAge = cc.maxAge || 0;
    if (!maxAge) {
      maxAge = Date.parse(originHeaders.get("Expires") || "") - Date.now();
      if (isNaN(maxAge) || maxAge < 0) maxAge = 0;
    }

    cache = {
      size: Number(originHeaders.get("content-length")),
      expires: Date.now() + maxAge,
      lastModified: originHeaders.get("last-modified") || "",
      etag: originHeaders.get("etag") || "",
      path: storePath,
      source,
      headers: originHeaders,
      maxAge,
      staleWhileRevalidate: cc.staleWhileRevalidate || 0,
      staleIfError: cc.staleIfError || 0,
    };

    setCache(cacheKey, cache);

    stream.respond({
      ":status": 200,
      ...serializeHeaders(originHeaders),
      "cache-status": `local; miss`,
      age: "0",
    });
    stream.end(originBody);
    return;
  }

  const now = Date.now();
  const fresh = now <= cache.expires;
  const withinSWR = now <= cache.expires + (cache.staleWhileRevalidate || 0);
  const withinSIE = now <= cache.expires + (cache.staleIfError || 0);

  // ------------------------
  // STALE: but serve via stale-while-revalidate
  // ------------------------
  if (!fresh && withinSWR) {
    // Serve stale immediately
    const body = await loadCachedBody(cache, cacheKey);
    const ageSeconds = computeAge(cache, cache.maxAge);

    stream.respond({
      ":status": 200,
      ...serializeHeaders(cache.headers),
      "cache-status": "local; stale-while-revalidate",
      age: String(ageSeconds),
    });

    if (reqMeta.method !== "HEAD") {
      stream.end(body);
    } else {
      stream.end();
    }

    // Background revalidation
    (async () => {
      try {
        const revalResp = await fetch("http://localhost:3001/html", {
          headers: cache.etag
            ? { "if-none-match": cache.etag }
            : cache.lastModified
            ? { "if-modified-since": cache.lastModified }
            : {},
        });

        if (revalResp.status === 200) {
          const originHeaders = revalResp.headers;
          const originBody = Buffer.from(await revalResp.arrayBuffer());

          let storePath = cache.path;
          let source: SourceType = cache.source;
          const contentLengthMB = convertBytesToMegabytes(
            Number(originHeaders.get("content-length"))
          );
          if (contentLengthMB > 1) {
            storePath = await diskStorage.save(cacheKey, originBody);
            source = "disk";
          } else {
            storePath = await memoryStorage.save(cacheKey, originBody);
          }

          const cc = parseCacheControl(originHeaders.get("Cache-Control"));
          let maxAge = cc.maxAge || 0;
          if (!maxAge) {
            maxAge = Date.parse(originHeaders.get("Expires") || "") - Date.now();
            if (isNaN(maxAge) || maxAge < 0) maxAge = 0;
          }

          setCache(cacheKey, {
            ...cache,
            expires: Date.now() + maxAge,
            lastModified: originHeaders.get("last-modified") || "",
            etag: originHeaders.get("etag") || "",
            headers: originHeaders,
            path: storePath,
            source,
            maxAge,
            staleWhileRevalidate: cc.staleWhileRevalidate || 0,
            staleIfError: cc.staleIfError || 0,
          });
        }
      } catch (e) {
        console.error("Background revalidation failed:", e);
      }
    })();

    return;
  }

  // ------------------------
  // STALE: try normal revalidation
  // ------------------------
  if (!fresh) {
    try {
      const revalidationHeaders: Record<string, string> = {};
      if (cache.etag) revalidationHeaders["if-none-match"] = cache.etag;
      if (cache.lastModified)
        revalidationHeaders["if-modified-since"] = cache.lastModified;

      const revalResp = await fetch("http://localhost:3001/html", {
        headers: revalidationHeaders,
      });

      const originHeaders = revalResp.headers;

      if (revalResp.status === 304) {
        // Extend freshness
        const cc = parseCacheControl(originHeaders.get("Cache-Control"));
        let maxAge = cc.maxAge || cache.maxAge || 0;
        cache.expires = Date.now() + maxAge;

        setCache(cacheKey, { ...cache, maxAge });

        const body = await loadCachedBody(cache, cacheKey);
        stream.respond({
          ":status": 200,
          ...serializeHeaders(cache.headers),
          "cache-status": "local; revalidated",
          age: "0",
        });
        stream.end(body);
        return;
      }

      if (revalResp.status === 200) {
        const originBody = Buffer.from(await revalResp.arrayBuffer());

        let storePath = cache.path;
        let source: SourceType = cache.source;
        const contentLengthMB = convertBytesToMegabytes(
          Number(originHeaders.get("content-length"))
        );
        if (contentLengthMB > 1) {
          storePath = await diskStorage.save(cacheKey, originBody);
          source = "disk";
        } else {
          storePath = await memoryStorage.save(cacheKey, originBody);
        }

        const cc = parseCacheControl(originHeaders.get("Cache-Control"));
        let maxAge = cc.maxAge || 0;
        if (!maxAge) {
          maxAge =
            Date.parse(originHeaders.get("Expires") || "") - Date.now();
          if (isNaN(maxAge) || maxAge < 0) maxAge = 0;
        }

        setCache(cacheKey, {
          ...cache,
          expires: Date.now() + maxAge,
          lastModified: originHeaders.get("last-modified") || "",
          etag: originHeaders.get("etag") || "",
          headers: originHeaders,
          path: storePath,
          source,
          maxAge,
          staleWhileRevalidate: cc.staleWhileRevalidate || 0,
          staleIfError: cc.staleIfError || 0,
        });

        stream.respond({
          ":status": 200,
          ...serializeHeaders(originHeaders),
          "cache-status": "local; refreshed",
          age: "0",
        });
        stream.end(originBody);
        return;
      }

      // If origin errors, fall back to stale-if-error
      if (withinSIE) {
        const body = await loadCachedBody(cache, cacheKey);
        const ageSeconds = computeAge(cache, cache.maxAge);

        stream.respond({
          ":status": 200,
          ...serializeHeaders(cache.headers),
          "cache-status": "local; stale-if-error",
          age: String(ageSeconds),
        });
        stream.end(body);
        return;
      }
    } catch (e) {
      if (withinSIE) {
        const body = await loadCachedBody(cache, cacheKey);
        const ageSeconds = computeAge(cache, cache.maxAge);

        stream.respond({
          ":status": 200,
          ...serializeHeaders(cache.headers),
          "cache-status": "local; stale-if-error",
          age: String(ageSeconds),
        });
        stream.end(body);
        return;
      }
      throw e;
    }
  }

  // ------------------------
  // HIT: serve from cache
  // ------------------------
  const ageSeconds = computeAge(cache, cache.maxAge);

  stream.respond({
    ":status": 200,
    ...serializeHeaders(cache.headers),
    "cache-status": "local; hit",
    age: String(ageSeconds),
  });

  if (reqMeta.method === "HEAD") {
    stream.end();
    return;
  }

  const body = await loadCachedBody(cache, cacheKey);
  stream.end(body);
});

server.listen(8443, () => {
  console.log("Edge server running at https://localhost:8443");
});
