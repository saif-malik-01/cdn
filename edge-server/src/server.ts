import * as fs from "fs";
import http2 from "http2";
import { CONFIG } from "./config.js";
import { RequestParser } from "./http/RequestParser.js";
import { CacheManager } from "./cache/CacheManager.js";
import { CachePolicy } from "./cache/CachePolicy.js";
import { ResponseSerializer } from "./http/ResponseSerializer.js";
import { OriginFetcher } from "./origin/OriginFetcher.js";
import { log } from "./utils/logger.js";
import { CacheKey } from "./cache/CacheKey.js";
import { RequestValidator } from "./http/RequestValidator.js";
import { StorageStrategy } from "./storage/StorageStrategy.js";
import { computeAge, convertBytesToMB } from "./utils/helpers.js";
import type { SourceType } from "./types.js";

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
  allowHTTP1: true,
};

const server = http2.createSecureServer(options);

server.on("stream", async (stream, headers) => {
  const req = RequestParser.parse(headers);

  // ------------------------
  // NOT ALLOWED: method not allowed
  // ------------------------
  if (!RequestValidator.validateMethod(req.method)) {
    ResponseSerializer.sendNotAllowed(stream);
    return;
  }

  const cacheKey = CacheKey.generateKey(req);
  const entry = await CacheManager.get(cacheKey);

  // ------------------------
  // HIT: serve from cache
  // ------------------------
  if (entry && CachePolicy.isFresh(entry)) {
    ResponseSerializer.sendHit(stream, entry);
    return;
  }

  try {
    if (entry && CachePolicy.canServeStaleWhileRevalidate(entry)) {
      ResponseSerializer.sendSWR(stream, entry);
    }

    const originResponse = await OriginFetcher.fetch(
      CONFIG.originUrl + req.path
    );
    const originHeaders = originResponse.headers;
    const originBody = Buffer.from(await originResponse.arrayBuffer());

    // reponse no-store
    if (originHeaders.get("Cache-Control")?.includes("no-store")) {
      ResponseSerializer.sendBypass(stream, originResponse);
      return;
    }

    const contentLengthMB = convertBytesToMB(
      Number(originHeaders.get("content-length"))
    );

    const storage = StorageStrategy.decide(contentLengthMB);

    let source: SourceType = "memory";
    if (contentLengthMB > CONFIG.cacheLimitMB) {
      source = "disk";
    }

    const path = await storage.save(cacheKey, originBody);

    const cc = RequestParser.parseCacheControl(
      originHeaders.get("Cache-Control")
    );

    let maxAge = cc.maxAge;
    if (!maxAge) {
      maxAge = Date.parse(originHeaders.get("Expires") || "") - Date.now();
      if (isNaN(maxAge) || maxAge < 0) maxAge = 0;
    }

    CacheManager.set(cacheKey, {
      size: Number(originHeaders.get("content-length")),
      expires: Date.now() + maxAge,
      lastModified: originHeaders.get("last-modified") || "",
      etag: originHeaders.get("etag") || "",
      path,
      source,
      headers: originHeaders,
      maxAge,
      staleWhileRevalidate: cc.staleWhileRevalidate || 0,
      staleIfError: cc.staleIfError || 0,
      key: cacheKey,
    });

    ResponseSerializer.sendMiss(stream, originBody);
  } catch (e: any) {
    ResponseSerializer.sendError(stream, e);
  }
});

server.listen(8443, () => {
  log("Edge server running at https://localhost:8443");
});
