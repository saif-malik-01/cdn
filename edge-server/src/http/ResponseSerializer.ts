import type { CacheEntry } from "../cache/CacheEntry.js";
import type { ServerHttp2Stream } from "http2";
import { createReadStream } from "fs";
import { computeAge, convertBytesToMB } from "../utils/helpers.js";
import { StorageStrategy } from "../storage/StorageStrategy.js";

export class ResponseSerializer {
  static async sendHit(stream: ServerHttp2Stream, entry: CacheEntry) {
    const storage = StorageStrategy.decide(convertBytesToMB(entry.size));
    const age = computeAge(entry);

    stream.respond({
      ":status": 200,
      "content-type": entry.headers["content-type"] || "text/plain",
      "cache-status": "local; hit",
      age: String(age),
    });

    if (entry.source === "memory") {
      const body = await storage.get(entry.key);
      stream.end(body);
      return;
    }

    const filePath = storage.getPath(entry.key);
    const fileStream = createReadStream(filePath);
    fileStream.pipe(stream);

    fileStream.on("error", (err) => {
      console.error("Error reading cached file:", err);
      if (!stream.closed) {
        stream.respond({ ":status": 500 });
        stream.end("Internal Server Error");
      }
    });
  }

  static async sendSWR(stream: ServerHttp2Stream, entry: CacheEntry) {
    const storage = StorageStrategy.decide(convertBytesToMB(entry.size));
    const body = await storage.get(entry.key);
    const age = computeAge(entry);
    stream.respond({
      ":status": 200,
      "content-type": entry.headers["content-type"] || "text/plain",
      "cache-status": "local; swr",
      age: String(age),
    });
    stream.end(body);
  }

  static async sendSIE(stream: ServerHttp2Stream, body: Buffer | null) {
    stream.respond({
      ":status": 200,
      "cache-status": "local; sie",
      age: "0",
    });
    stream.end(body);
  }

  static async sendMiss(stream: ServerHttp2Stream, body: Buffer | null) {
    stream.respond({
      ":status": 200,
      "cache-status": "local; miss",
      age: "0",
    });
    stream.end(body);
  }

  static sendNotAllowed(stream: ServerHttp2Stream) {
    stream.respond({
      ":status": 405,
      "content-type": "text/plain",
      allow: "GET, HEAD",
    });
    stream.end("405: Method Not Allowed");
  }

  static sendError(stream: ServerHttp2Stream, error: Error) {
    stream.respond({ ":status": 502 });
    stream.end("Bad Gateway: " + error.message);
  }
}
