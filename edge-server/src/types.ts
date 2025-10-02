export interface CacheMeta {
  size: number;
  expires: number;
  etag: string;
  path: string;
  source: "memory" | "disk";
  headers: Headers;
}
