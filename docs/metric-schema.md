# 📊 Metrics Schema Documentation

## Overview

This document defines the **Prometheus metrics schema** used by the Edge CDN server for monitoring cache, network, and origin performance.

All metrics are registered through the [`prom-client`](https://github.com/siimon/prom-client) library and exposed via the `/metrics` endpoint for Prometheus scraping.

---

## 🔧 Initialization

```ts
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });
```

* Collects **Node.js default metrics** (CPU, memory, event loop lag, etc.)
* Custom application metrics (listed below) are registered to the same registry.
* Accessible via `/metrics` route over HTTPS.

---

## 📈 Metric Definitions

### 1. **cdn_origin_fetch_total**

| Property           | Description                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **Type**           | `Counter`                                                                                       |
| **Help**           | Total number of origin fetch attempts                                                           |
| **Use Case**       | Indicates how many times the edge server has contacted the origin server for content retrieval. |
| **Example Output** | `cdn_origin_fetch_total 1523`                                                                   |

---

### 2. **cdn_origin_errors_total**

| Property           | Description                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Type**           | `Counter`                                                                                                    |
| **Help**           | Total number of origin fetches that resulted in error                                                        |
| **Use Case**       | Helps track transient or systemic network/origin failures. Should be compared with `cdn_origin_fetch_total`. |
| **Example Output** | `cdn_origin_errors_total 47`                                                                                 |

---

### 3. **cdn_request_coalesced_total**

| Property           | Description                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Type**           | `Counter`                                                                                         |
| **Help**           | Number of times multiple concurrent requests were coalesced (deduplicated)                        |
| **Use Case**       | Measures how often identical concurrent requests were merged to prevent redundant origin fetches. |
| **Example Output** | `cdn_request_coalesced_total 22`                                                                  |

---

### 4. **cdn_origin_retries_total**

| Property           | Description                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Type**           | `Counter`                                                                                                     |
| **Help**           | Total number of retries when fetching from origin                                                             |
| **Use Case**       | Shows retry volume caused by transient failures. High values may indicate unstable network or origin service. |
| **Example Output** | `cdn_origin_retries_total 105`                                                                                |

---

### 5. **cdn_origin_failures_total**

| Property           | Description                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **Type**           | `Counter`                                                                                             |
| **Help**           | Total number of failed origin fetches after all retries                                               |
| **Use Case**       | Indicates hard failures where all retry attempts were exhausted. Should ideally remain close to zero. |
| **Example Output** | `cdn_origin_failures_total 3`                                                                         |

---

### 6. **origin_active_connections**

| Property           | Description                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Type**           | `Gauge`                                                                                                          |
| **Help**           | Number of currently active HTTP connections to origin                                                            |
| **Use Case**       | Tracks the number of concurrent open connections to the origin. Useful for detecting connection pool exhaustion. |
| **Example Output** | `origin_active_connections 4`                                                                                    |

---

### 7. **origin_fetch_latency_ms**

| Property           | Description                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Type**           | `Histogram`                                                                                          |
| **Help**           | Latency of origin fetch requests in milliseconds                                                     |
| **Buckets**        | `[50, 100, 200, 400, 800, 1600, 3200, 5000]`                                                         |
| **Use Case**       | Measures end-to-end latency distribution for origin fetch operations. Critical for performance SLAs. |
| **Example Output** |                                                                                                      |

```
# TYPE origin_fetch_latency_ms histogram
origin_fetch_latency_ms_bucket{le="50"} 12
origin_fetch_latency_ms_bucket{le="100"} 84
origin_fetch_latency_ms_bucket{le="200"} 175
origin_fetch_latency_ms_sum 11542
origin_fetch_latency_ms_count 287
```

---

## 🧮 Metric Registration

All custom metrics are explicitly registered with the Prometheus registry:

```ts
register.registerMetric(originFetchTotal);
register.registerMetric(originErrorsTotal);
register.registerMetric(originRetriesTotal);
register.registerMetric(originFailuresTotal);
register.registerMetric(originFetchLatency);
register.registerMetric(originActiveConnections);
register.registerMetric(requestCoalescedTotal);
```

---

## 📊 Prometheus Scrape Example

Example `/metrics` endpoint output:

```
# HELP cdn_origin_fetch_total Total number of origin fetch attempts
# TYPE cdn_origin_fetch_total counter
cdn_origin_fetch_total 1523

# HELP cdn_origin_errors_total Total number of origin fetches that resulted in error
# TYPE cdn_origin_errors_total counter
cdn_origin_errors_total 47

# HELP cdn_origin_failures_total Total number of failed origin fetches after all retries
# TYPE cdn_origin_failures_total counter
cdn_origin_failures_total 3

# HELP origin_active_connections Number of currently active HTTP connections to origin
# TYPE origin_active_connections gauge
origin_active_connections 4

# HELP origin_fetch_latency_ms Latency of origin fetch requests in milliseconds
# TYPE origin_fetch_latency_ms histogram
origin_fetch_latency_ms_bucket{le="50"} 12
origin_fetch_latency_ms_bucket{le="100"} 84
origin_fetch_latency_ms_bucket{le="200"} 175
origin_fetch_latency_ms_sum 11542
origin_fetch_latency_ms_count 287
```

---

## 🧠 Usage Tips

* **Monitor trends:**
  Compare `cdn_origin_errors_total / cdn_origin_fetch_total` for error ratios.

* **Detect overload:**
  Watch `origin_active_connections` and `origin_fetch_latency_ms` percentiles.

* **Optimize caching:**
  Use `cdn_request_coalesced_total` to gauge cache efficiency in high concurrency.
