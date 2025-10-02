import * as fs from "node:fs";
import http2 from "http2";

import computeCacheKey from "./libs/cacheKey.js";
import {
  serializeHeaders,
  parseRequest,
  parseCacheControl,
} from "./libs/parser.js";
import { validateMethod } from "./libs/validate.js";
import { getCache, setCache } from "./libs/LRUCache.js";
import { convertBytesToMegabytes } from "./libs/utils.js";
import memoryStorage from "./libs/memoryStorage.js";
import diskStorage from "./libs/diskStorage.js";
import type { SourceType } from "./types.js";

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
  allowHTTP1: true,
};

const server = http2.createSecureServer(options);

server.on("stream", async (stream, headers) => {
  const reqMeta = parseRequest(headers);
  const cacheKey = computeCacheKey(reqMeta);

  if (validateMethod(reqMeta.method)) {
    stream.respond({
      ":status": 405,
      "content-type": headers["content-type"],
      allow: "GET, HEAD",
    });
    stream.end(`405 Method ${reqMeta.method} Not Allowed`);
    return;
  }

  const cache = getCache(cacheKey);
  if (!cache) {
    const originResponse = await fetch("http://localhost:3001/html");
    const originHeaders = originResponse.headers;
    const originBody = Buffer.from(await originResponse.arrayBuffer());

    if (originHeaders.get("Cache-Control")?.includes("no-store")) {
      stream.respond({
        ":status": 200,
        ...serializeHeaders(originHeaders),
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

    let maxAge = parseCacheControl(originHeaders.get("Cache-Control"));
    if (!maxAge) {
      maxAge = Date.parse(originHeaders.get("Expires") || "") - Date.now();
      if (isNaN(maxAge) || maxAge < 0) {
        maxAge = 0;
      }
    }

    setCache(cacheKey, {
      size: Number(originHeaders.get("content-length")),
      expires: Date.now() + maxAge,
      lastModified: originHeaders.get("last-modified") || "",
      etag: originHeaders.get("etag") || "",
      path: storePath,
      source,
      headers: originHeaders,
    });

    stream.respond({
      ":status": 200,
      "cache-status": `local; miss`,
      age: "0",
    });
    stream.end(originBody);
    return;
  }

  if (Date.now() > cache.expires) {
    const revalidationHeaders: Record<string, string> = {};
    if (cache.etag) {
      revalidationHeaders["if-none-match"] = cache.etag;
    }
    if (cache.lastModified) {
      revalidationHeaders["if-modified-since"] = cache.lastModified;
    }

    const revalidationResponse = await fetch("http://localhost:3001/html", {
      headers: revalidationHeaders,
    });

    const originHeaders = revalidationResponse.headers;
    const originBody = Buffer.from(await revalidationResponse.arrayBuffer());
    let maxAge = parseCacheControl(originHeaders.get("Cache-Control"));
    if (!maxAge) {
      maxAge = Date.parse(originHeaders.get("Expires") || "") - Date.now();
      if (isNaN(maxAge) || maxAge < 0) {
        maxAge = 0;
      }
    }

    setCache(cacheKey, {
      size: Number(originHeaders.get("content-length")),
      expires: Date.now() + maxAge,
      lastModified: originHeaders.get("last-modified") || "",
      etag: originHeaders.get("etag") || "",
      headers: originHeaders,
      path: cache.path,
      source: cache.source,
    });

    let storePath = cache.path;
    let source: SourceType = cache.source;
    if (revalidationResponse.status === 200) {
      const contentLengthMB = convertBytesToMegabytes(
        Number(originHeaders.get("content-length"))
      );
      if (contentLengthMB > 1) {
        storePath = await diskStorage.save(cacheKey, originBody);
        source = "disk";
      } else {
        storePath = await memoryStorage.save(cacheKey, originBody);
      }

      stream.respond({
        ":status": 200,
        etag: originHeaders.get("etag") || "",
        "last-modified": originHeaders.get("last-modified") || "",
        "cache-status": `local; miss`,
      });
      stream.end(originBody);
      return;
    }
  }

  const cacheHeaders = cache.headers;
  stream.respond({
    ":status": 200,
    "content-type": cacheHeaders.get("content-type"),
    "cache-status": "local; hit",
  });

  if (reqMeta.method == "HEAD") {
    stream.end();
    return;
  }

  let body = cache.path;
  if (cache.source === "memory") {
    body = await memoryStorage.get(cacheKey);
  } else {
    body = await diskStorage.get(cacheKey);
  }
  stream.end(body);
});

server.listen(8443, () => {
  console.log("Edge server running at https://localhost:8443");
});
