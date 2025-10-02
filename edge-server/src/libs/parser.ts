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

/**
 * Parses Cache-Control header into structured values.
 * Supports max-age, stale-while-revalidate, stale-if-error.
 */
export function parseCacheControl(headerValue?: string | null) {
  if (!headerValue) {
    return { maxAge: 0, staleWhileRevalidate: 0, staleIfError: 0 };
  }

  const directives = headerValue
    .toLowerCase()
    .split(",")
    .map((d) => d.trim());

  let maxAge = 0;
  let staleWhileRevalidate = 0;
  let staleIfError = 0;

  for (const dir of directives) {
    if (dir.startsWith("max-age=")) {
      const val = parseInt(dir.replace("max-age=", ""), 10);
      if (!isNaN(val)) maxAge = val * 1000; // store in ms
    }
    if (dir.startsWith("s-maxage=")) {
      const val = parseInt(dir.replace("s-maxage=", ""), 10);
      if (!isNaN(val)) maxAge = val * 1000; // treat s-maxage as override
    }
    if (dir.startsWith("stale-while-revalidate=")) {
      const val = parseInt(dir.replace("stale-while-revalidate=", ""), 10);
      if (!isNaN(val)) staleWhileRevalidate = val * 1000; // ms
    }
    if (dir.startsWith("stale-if-error=")) {
      const val = parseInt(dir.replace("stale-if-error=", ""), 10);
      if (!isNaN(val)) staleIfError = val * 1000; // ms
    }
  }

  return { maxAge, staleWhileRevalidate, staleIfError };
}

