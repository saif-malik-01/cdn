# ⚙️ APIs & Configuration Knobs

## Overview

This document describes the **external HTTP APIs** and **internal configuration parameters** for the Edge Cache Server.
The server acts as a **secure reverse proxy** that caches origin content, revalidates responses, and exposes operational metrics for monitoring.

---

## 🧭 API Endpoints

### Base URL

```
https://<edge-host>:8443
```

### Supported Protocols

* **HTTP/2 (preferred)** with fallback to **HTTP/1.1** (`allowHTTP1: true`)
* Uses **TLS certificates** (`key.pem`, `cert.pem`)

---

## 📡 Routes

### 1. `GET /metrics`

**Description:**
Exposes runtime **Prometheus metrics** for observability and performance analysis.

**Response:**

* **Content-Type:** `text/plain; version=0.0.4`
* **Status:** `200 OK`

**Example Output:**

```
# HELP originFetchTotal Total number of origin fetch attempts
# TYPE originFetchTotal counter
originFetchTotal 452
# HELP originFetchLatency Latency of origin fetch requests
# TYPE originFetchLatency histogram
originFetchLatency_sum 123.45
originFetchLatency_count 452
```

**Usage:**

```bash
curl -k https://localhost:8443/metrics
```

---

### 2. `* /<path>`

**Description:**
All other routes act as **reverse proxy endpoints**, redirecting requests to the **origin server** (`CONFIG.originUrl`) while applying caching logic.

**Flow Overview:**

| Stage                            | Behavior                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| **Request Validation**           | Incoming request is parsed and validated by `RequestParser` and `RequestValidator`.          |
| **Cache Lookup**                 | Uses `CacheKey` and `CacheManager` to check for a stored entry.                              |
| **Cache MISS**                   | If not cached, fetches from origin using `OriginFetcher`, stores it, and responds to client. |
| **Cache HIT**                    | Serves directly from cache if `CachePolicy.isFresh(entry)` returns `true`.                   |
| **SWR (Stale-While-Revalidate)** | Serves stale content while revalidating asynchronously.                                      |
| **SIE (Stale-If-Error)**         | Serves stale content if origin request fails.                                                |
| **Error Handling**               | Returns appropriate HTTP status via `ResponseSerializer`.                                    |

---

## 🧩 Request Flow Diagram

```text
 ┌────────────────────────────┐
 │   Incoming HTTPS Request   │
 └──────────────┬─────────────┘
                │
        Parse & Validate
                │
                ▼
       CacheManager.get(key)
        │           │
        │           ├─▶ HIT → CachePolicy.isFresh → sendHit()
        │           │
        │           ├─▶ STALE → canServeSWR → sendSWR() + revalidate()
        │           │
        │           └─▶ MISS → OriginFetcher.fetch() → CacheManager.set()
        │
        ▼
     ResponseSerializer
                │
                ▼
          Send Response
```

---

## 🧱 Core Components

| Component              | Responsibility                                                  |
| ---------------------- | --------------------------------------------------------------- |
| **RequestParser**      | Extracts path, method, and headers from HTTP/2 request stream   |
| **RequestValidator**   | Rejects disallowed HTTP methods                                 |
| **CacheManager**       | Handles cache storage, retrieval, and initialization            |
| **CachePolicy**        | Decides whether cache entries are fresh or eligible for SWR/SIE |
| **CacheKey**           | Generates unique cache keys based on request attributes         |
| **OriginFetcher**      | Fetches upstream resources with retry and coalescing            |
| **ResponseSerializer** | Formats and sends responses for HIT, MISS, SWR, SIE, or errors  |
| **StorageStrategy**    | Chooses memory vs. disk based on `memoryThresholdMB`            |
| **Metrics Register**   | Exposes Prometheus metrics via `/metrics` route                 |

---

## 🧰 Configuration Knobs

All configuration values are defined in `config.js`.

```ts
export const CONFIG = {
  originUrl: "http://localhost:3001",
  cacheLimit: 100,             // Max number of cached files
  cacheFileLimitMB: 512,       // Max size per cached file
  memoryThresholdMB: 1,        // Memory vs. storage threshold (MB)
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
```

### Configuration Details

| Key                         | Type      | Description                                                   |
| --------------------------- | --------- | ------------------------------------------------------------- |
| `originUrl`                 | `string`  | Base URL of the origin server that responses are fetched from |
| `cacheLimit`                | `number`  | Maximum number of cache entries allowed                       |
| `cacheFileLimitMB`          | `number`  | Maximum file size allowed in cache (MB)                       |
| `memoryThresholdMB`         | `number`  | File size threshold for memory vs. disk storage strategy      |
| `agent.keepAliveTimeout`    | `number`  | Timeout for idle connections before closing                   |
| `agent.keepAliveMaxTimeout` | `number`  | Maximum keep-alive duration per connection                    |
| `agent.connections`         | `number`  | Max concurrent origin connections                             |
| `agent.pipelining`          | `number`  | Number of HTTP/2 requests pipelined per connection            |
| `retry.maxRetries`          | `number`  | Maximum number of retry attempts for origin requests          |
| `retry.baseDelayMs`         | `number`  | Initial retry delay in milliseconds                           |
| `retry.maxDelayMs`          | `number`  | Maximum delay between retries                                 |
| `retry.retryOnHttpError`    | `boolean` | Enables retries on HTTP 5xx responses                         |

---

## 🚀 Example Run

**Start the server:**

```bash
npm install
npm run dev
```

**Access endpoints:**

```bash
curl -k https://localhost:8443/metrics
curl -k https://localhost:8443/path/to/resource
```

**Expected output:**

```
Edge server running at https://localhost:8443
```