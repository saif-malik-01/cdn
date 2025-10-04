import client from "prom-client";

const register = new client.Registry();

client.collectDefaultMetrics({ register });


export const originFetchTotal = new client.Counter({
  name: "cdn_origin_fetch_total",
  help: "Total number of origin fetch attempts",
});

export const originErrorsTotal = new client.Counter({
  name: "cdn_origin_errors_total",
  help: "Total number of origin fetches that resulted in error",
});

export const requestCoalescedTotal = new client.Counter({
  name: "cdn_request_coalesced_total",
  help: "Number of times multiple concurrent requests were coalesced (deduplicated)",
});

export const originRetriesTotal = new client.Counter({
  name: "cdn_origin_retries_total",
  help: "Total number of retries when fetching from origin",
});

export const originFailuresTotal = new client.Counter({
  name: "cdn_origin_failures_total",
  help: "Total number of failed origin fetches after all retries",
});

export const originActiveConnections = new client.Gauge({
  name: "origin_active_connections",
  help: "Number of currently active HTTP connections to origin",
});

export const originFetchLatency = new client.Histogram({
  name: "origin_fetch_latency_ms",
  help: "Latency of origin fetch requests in milliseconds",
  buckets: [50, 100, 200, 400, 800, 1600, 3200, 5000],
});

register.registerMetric(originFetchTotal);
register.registerMetric(originErrorsTotal);
register.registerMetric(originRetriesTotal);
register.registerMetric(originFailuresTotal);
register.registerMetric(originFetchLatency);
register.registerMetric(originActiveConnections);
register.registerMetric(requestCoalescedTotal);

export { register };
