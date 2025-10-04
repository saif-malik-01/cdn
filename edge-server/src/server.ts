import * as fs from "fs";
import http2 from "http2";

import { RequestParser } from "./http/RequestParser.js";
import { CacheManager } from "./cache/CacheManager.js";
import { CachePolicy } from "./cache/CachePolicy.js";
import { ResponseSerializer } from "./http/ResponseSerializer.js";
import { OriginFetcher } from "./origin/OriginFetcher.js";
import { log } from "./utils/logger.js";
import { CacheKey } from "./cache/CacheKey.js";
import { RequestValidator } from "./http/RequestValidator.js";
import { StorageStrategy } from "./storage/StorageStrategy.js";
import { convertBytesToMB } from "./utils/helpers.js";

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
  if (RequestValidator.validateMethod(req.method)) {
    ResponseSerializer.sendNotAllowed(stream);
    return;
  }

  const cacheKey = CacheKey.generateKey(req);
  const entry = await CacheManager.get(cacheKey);

  // ------------------------
  // MISS: get, save and send the latest
  // ------------------------
  if (!entry) {
    const originResponse = await OriginFetcher.get(req.path);
    const body = await CacheManager.set(cacheKey, originResponse);
    await ResponseSerializer.sendMiss(stream, body);
    return;
  }

  // ------------------------
  // HIT: serve from cache
  // ------------------------
  if (CachePolicy.isFresh(entry)) {
    await ResponseSerializer.sendHit(stream, entry);
    return;
  }

  // ------------------------
  // SWR: serve from cache but revalidate
  // ------------------------
  if (CachePolicy.canServeStaleWhileRevalidate(entry)) {
    ResponseSerializer.sendHit(stream, entry);
  }

  try {
    const originResponse = await OriginFetcher.get(
      req.path,
      entry.etag
        ? { "if-none-match": entry.etag }
        : entry.lastModified
        ? { "if-modified-since": entry.lastModified }
        : {}
    );

    // ------------------------
    // SWI: serve from cache
    // ------------------------
    if (!originResponse.ok && CachePolicy.canServeStaleIfError(entry)) {
      const storage = StorageStrategy.decide(convertBytesToMB(entry.size));
      const body = await storage.get(cacheKey);
      ResponseSerializer.sendMiss(stream, body);
      return;
    }

    const body = await CacheManager.set(cacheKey, originResponse);

    if (!CachePolicy.canServeStaleWhileRevalidate(entry)) {
      ResponseSerializer.sendMiss(stream, body);
    }
  } catch (e: any) {
    log(e)
    ResponseSerializer.sendError(stream, e);
  }
});

server.listen(8443, () => {
  log("Edge server running at https://localhost:8443");
});
