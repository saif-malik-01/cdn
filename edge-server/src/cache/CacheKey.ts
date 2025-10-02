import type { ParsedRequest } from "../http/RequestParser.js";

export class CacheKey {
  static generateKey(req: ParsedRequest) {
    const queryKeys = Object.keys(req.query).sort();
    const normalizedQuery = queryKeys
      .map((k) => `${k}=${req.query[k]}`)
      .join("&");
    return `${req.method}:${req.host}:${req.path}?${normalizedQuery}`;
  }
}
