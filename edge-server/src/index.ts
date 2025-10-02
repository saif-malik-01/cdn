import * as fs from "node:fs";
import http2 from "http2";

import computeCacheKey from "./cacheKey.js";
import parseRequest from "./requestParser.js";
import { validateMethod } from "./validate.js";
import { getCache, setCache } from "./LRUCache.js";
import { convertBytesToMegabytes } from "./utils.js";

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
    const originBody = Buffer.from(await originResponse.arrayBuffer());
    const headers = originResponse.headers;

    const contentLengthMB = convertBytesToMegabytes(Number(headers.get("content-length")));
    if (contentLengthMB > 5) {
      stream.respond({
        ":status": 413,
        "content-type": headers.get("content-type") || "text/html",
        "cache-status": `local; error=content_too_large`,
      });
      stream.end("413 Content Too Large");
      return;
    }

    setCache(cacheKey, {
      size: Number(headers.get("content-length")) || file.length,
      expires: Date.now() + 60000,
      etag: headers.get("etag") || "",
      path: file,
      source: "memory",
      headers,
    });

    stream.respond({
      ":status": 200,
      "content-type": headers.get("content-type") || "text/html",
      "cache-status": `local; miss`,
    });
    stream.end("miss");
    return;
  }

  const cacheStatus = Date.now() > cache.expires ? "stale" : "hit";
  const cacheHeaders = cache.headers || new Headers();

  stream.respond({
    ":status": 200,
    "content-type": cacheHeaders.get("content-type"),
    "cache-status": `local; ${cacheStatus}`,
  });
  let body = cache.path;
  if (reqMeta.method == "HEAD") body = undefined;
  stream.end(body);
});

server.listen(8443, () => {
  console.log("Edge server running at https://localhost:8443");
});
