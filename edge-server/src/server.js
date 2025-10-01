import fs from "fs";
import http2 from "http2";

import computeCacheKey from "./cacheKey.js";
import parseRequest from "./requestParser.js";
import { validateMethod } from "./validate.js";
import { getCache } from "./memoCache.js";

const options = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
  allowHTTP1: true,
};

const server = http2.createSecureServer(options);

server.on("stream", (stream, headers) => {
  const reqMeta = parseRequest(headers);
  const cacheKey = computeCacheKey(reqMeta);

  if (validateMethod(reqMeta.method)) {
    stream.respond({
      ":status": 405,
      "content-type": "text/plain",
      allow: "GET, HEAD",
    });
    stream.end(`405 Method ${reqMeta.method} Not Allowed`);
    return;
  }

  const cache = getCache(cacheKey);
  if (!cache) {
    stream.respond({
      ":status": 200,
      "content-type": "text/plain",
      "cache-status": `local; miss`,
    });
    stream.end("miss");
    return;
  }

  stream.respond({ ":status": 200, "content-type": "text/plain" });
  let body = `Edge server up. Cache key: ${cacheKey}\n`;
  if (reqMeta.method == "HEAD") body = undefined;
  stream.end(body);
});

server.listen(8443, () => {
  console.log("Edge server running at https://localhost:8443");
});
