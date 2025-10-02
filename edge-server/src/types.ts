import type { IncomingHttpHeaders } from "node:http2";

export interface CacheMeta {
  size: number;
  expires: number;
  lastModified: string;
  createdAt: number;
  etag: string;
  path: string;
  source: "memory" | "disk";
  headers: Headers;
}

export interface RequestMeta {
  method: string | undefined;
  host: string | undefined;
  path: string | undefined;
  query: Record<string, string | undefined>;
  headers: IncomingHttpHeaders;
}

export type SourceType = "memory" | "disk";
