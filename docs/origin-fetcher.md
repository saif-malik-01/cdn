# 🏗️ OriginFetcher Architecture

## Overview

The `OriginFetcher` is a resilient, concurrent-safe HTTP client built on top of **Undici**.
It provides efficient origin fetching with **connection pooling**, **retry logic**, **request coalescing**, and **Prometheus metrics** integration.

---

## Architecture

### 1. Connection Management

Each origin base URL is associated with its own **Undici `Agent`**, which manages connection pooling and keep-alive behavior.

**Configuration:**

```ts
const AGENT_CONFIG = {
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 60_000,
  connections: 10,
  pipelining: 0,
};
```

* **Goal:** Reuse TCP connections for performance and stability.
* **Managed via:** `_getDispatcher(baseURL)`

---

### 2. Retry Handling

All fetch requests are executed with an **exponential backoff retry mechanism** to handle transient network or server errors.

**Configuration:**

```ts
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  retryOnHttpError: true,
};
```

* Retries are triggered for:

  * Network errors (connection resets, timeouts)
  * HTTP 5xx responses
* Delay increases exponentially per attempt until `maxDelayMs`.

---

### 3. Request Coalescing

Concurrent identical requests are **deduplicated** to prevent redundant origin fetches.

* Uses a static `_inFlight` map:

  * Key: Full request URL
  * Value: Promise of the in-progress response
* If the same URL is already being fetched, the new request reuses the existing Promise.

**Metric:** `requestCoalescedTotal` (incremented when coalescing occurs)

---

### 4. Metrics Integration

The fetcher exposes runtime metrics for performance and reliability monitoring.
These metrics can be consumed by **Prometheus** or similar observability systems.

| Metric Name               | Type      | Description                            |
| ------------------------- | --------- | -------------------------------------- |
| `originFetchTotal`        | Counter   | Total number of origin fetch attempts  |
| `originErrorsTotal`       | Counter   | Total number of failed fetches         |
| `originRetriesTotal`      | Counter   | Total number of retry attempts         |
| `originFailuresTotal`     | Counter   | Total number of unrecoverable failures |
| `originFetchLatency`      | Histogram | Latency of successful fetches          |
| `originActiveConnections` | Gauge     | Number of active TCP connections       |
| `requestCoalescedTotal`   | Counter   | Number of coalesced requests           |

---

### 5. Data Flow

```text
Client Request
     │
     ▼
 ┌────────────────────┐
 │ OriginFetcher.fetch │
 └────────────────────┘
     │
     ├─▶ Check _inFlight → Coalesce if ongoing
     │
     ├─▶ Get or create Agent (connection pool)
     │
     ├─▶ Perform fetch with retry loop
     │       │
     │       ├─▶ Retry on 5xx or network error
     │       └─▶ Backoff with exponential delay
     │
     ├─▶ Record metrics (latency, retries, errors)
     │
     └─▶ Return Response
```

---

### 6. Core Components

| Component                                   | Responsibility                                                    |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `_getDispatcher(baseURL)`                   | Retrieves or creates an `Agent` for the base URL                  |
| `_fetchWithRetry(url, headers, dispatcher)` | Executes fetch with retry and backoff                             |
| `fetch(url, headers)`                       | Public method; handles coalescing, caching, and response creation |
| `_dispatchers`                              | Static map for connection pool instances                          |
| `_inFlight`                                 | Static map for coalescing in-progress requests                    |

---

### 7. Concurrency & Safety

* Uses static maps to share state across all fetch calls.
* Ensures **thread-safe coalescing** within the Node.js event loop.
* Each origin’s connections are isolated by `Agent` instance.

---

### 8. Future Enhancements

* Per-request configurable timeout.
* Circuit breaker pattern for repeated failures.
* Optional persistent caching (e.g., Redis or memory LRU).
* Request prioritization and batching.
No problem — here’s what happened: download links sometimes fail in temporary chats.
You can still get your file easily — here’s the full content of **`origin_fetcher_architecture.md`** again (just copy and save it locally under that filename):

---

### 9. Example Usage

```ts
import { OriginFetcher } from "./services/originFetcher.js";

async function getUserData(id) {
  const res = await OriginFetcher.fetch(`/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user ${id}`);
  return res.json();
}
```