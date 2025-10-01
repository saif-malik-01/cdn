export default function computeCacheKey(reqMeta) {
  const queryKeys = Object.keys(reqMeta.query).sort();
  const normalizedQuery = queryKeys.map(k => `${k}=${reqMeta.query[k]}`).join("&");
  return `${reqMeta.method}:${reqMeta.host}:${reqMeta.path}?${normalizedQuery}`;
}
