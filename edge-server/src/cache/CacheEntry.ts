export interface CacheEntry {
  key: string;
  size: number;
  expires: number;
  maxAge: number;
  staleWhileRevalidate: number;
  staleIfError: number;
  lastModified?: string;
  etag?: string;
  headers: Record<string, string>;
  path: string;
  source: "memory" | "disk";
}
