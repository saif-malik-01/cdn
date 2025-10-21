export const CONFIG = {
  originUrl: "http://localhost:3001",
  cacheLimit: 100, // limit max cache file
  cacheFileLimitMB: 512, // limit max file size
  memoryThresholdMB: 1, // threshold for ram vs storage
  agent: {
    keepAliveTimeout: 10_000,
    keepAliveMaxTimeout: 60_000,
    connections: 10,
    pipelining: 0,
  },
  retry: {
    maxRetries: 3,
    baseDelayMs: 200,
    maxDelayMs: 2000,
    retryOnHttpError: true,
  },
};
