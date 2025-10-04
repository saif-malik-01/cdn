import { CONFIG } from "../config.js";

export class OriginFetcher {
  static async get(url: string, headers: Record<string, string> = {}) {
    const res = await fetch(CONFIG.originUrl + url, { headers });
    return res;
  }
}
