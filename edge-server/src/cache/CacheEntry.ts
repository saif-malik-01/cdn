export interface CacheEntry {
  key: string;
  size: number;
  expires: number;
  maxAge: number;
  staleWhileRevalidate: number;
  staleIfError: number;
  lastModified?: string;
  etag?: string;
  headers: Headers;
  path: string;
  source: "memory" | "disk";
}
