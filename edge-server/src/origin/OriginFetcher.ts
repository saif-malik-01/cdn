export class OriginFetcher {
  static async fetch(url: string, headers: Record<string, string> = {}) {
    const res = await fetch(url, { headers });
    return res;
  }
}
