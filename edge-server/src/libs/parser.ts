import type { IncomingHttpHeaders } from "node:http2";

export function parseRequest(headers: IncomingHttpHeaders) {
  return {
    method: headers[":method"],
    host: headers[":authority"],
    path: headers[":path"]?.split("?")[0],
    query: Object.fromEntries(
      new URL("https://dummy" + headers[":path"]).searchParams
    ),
    headers,
  };
}

export function serializeHeaders(headers: Headers) {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export function parseCacheControl(header: string | null): number | null {
  if (!header) return null;
  const directives = header.split(",").map((dir) => dir.trim());
  for (const dir of directives) {
    if (dir.startsWith("max-age=")) {
      const parts = dir.split("=");
      const seconds = parseInt(parts[1] || "0", 10);
      if (!isNaN(seconds)) {
        return seconds;
      }
    }
  }
  return null;
}

