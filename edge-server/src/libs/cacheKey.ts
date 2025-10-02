import crypto from "crypto";
import type { RequestMeta } from "../types.js";

export default function computeCacheKey(reqMeta: RequestMeta) {
  const queryKeys = Object.keys(reqMeta.query).sort();
  const normalizedQuery = queryKeys
    .map((k) => `${k}=${reqMeta.query[k]}`)
    .join("&");
  return `${reqMeta.method}:${reqMeta.host}:${reqMeta.path}?${normalizedQuery}`;
}

export function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}
