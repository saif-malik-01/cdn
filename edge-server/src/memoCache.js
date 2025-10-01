const cache = new Map();

export function setCache(key, value, ttl = 5000) {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl
  });
}

export function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}