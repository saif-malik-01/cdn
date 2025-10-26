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
import { register as pRegister } from "./utils/metrics.js";
await CacheManager.initialize();

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
  allowHTTP1: true,
};

const server = http2.createSecureServer(options);

server.on("stream", async (stream, headers) => {
  const req = RequestParser.parse(headers);

  if (req.path === "/health" && req.method == "GET") {
    stream.respond({
      "content-type": "text/plain",
      ":status": 200,
    });
    stream.end("Healthy");
    return;
  }

  if (req.path === "/metrics" && req.method == "GET") {
    const metrics = await pRegister.metrics();
    stream.respond({
      "content-type": pRegister.contentType,
      ":status": 200,
    });
    stream.end(metrics);
    return;
  }

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
    const originResponse = await OriginFetcher.fetch(req.path);
    const data = await CacheManager.set(cacheKey, originResponse);
    await ResponseSerializer.sendMiss(stream, data);
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
    ResponseSerializer.sendSWR(stream, entry);
  }

  try {
    const originResponse = await OriginFetcher.fetch(
      req.path,
      entry.etag
        ? { "if-none-match": entry.etag }
        : entry.lastModified
        ? { "if-modified-since": entry.lastModified }
        : {}
    );

    const body = await CacheManager.set(cacheKey, originResponse as Response);

    if (!CachePolicy.canServeStaleWhileRevalidate(entry)) {
      await ResponseSerializer.sendMiss(stream, body);
    }
  } catch (e: any) {
    log(e);
    if (CachePolicy.canServeStaleWhileRevalidate(entry)) return;
    // ------------------------
    // SIE: serve stale while error
    // ------------------------
    if (CachePolicy.canServeStaleIfError(entry)) {
      const storage = StorageStrategy.decide(convertBytesToMB(entry.size));
      const body = await storage.get(cacheKey);
      ResponseSerializer.sendSIE(stream, body);
      return;
    }
    ResponseSerializer.sendError(stream, e);
  }
});

server.on("request", (req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Healthy");
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(8443, "0.0.0.0", () => {
  log("Edge server running at https://localhost:8443");
});
