# 🌍 CDN System Design

A **Content Delivery Network (CDN)** prototype designed to serve static assets (images, CSS/JS, video segments) with **low latency**, **high availability**, and **secure delivery** across multiple edge locations.

---

## 🚀 Goals / Scope (v1)

* Serve static assets efficiently with caching and origin protection.
* Support HTTPS, HTTP/2, and QUIC-ready architecture.
* Global edge presence via **Geo-DNS** routing.
* Implement **cache invalidation APIs**, **rate limiting**, and **DDoS protection**.
* Provide **metrics, logging, autoscaling**, and **cert management**.

---

## 🏗️ High-Level Architecture

```
             +-----------------+
             |   Control Plane  |  <-- (Management APIs, UI, Cert Manager)
             +-----------------+
                      |
      +---------------+---------------+
      |                               |
+-------------+               +----------------+
|  Origin(s)  |               | Origin Storage  |
|  (App/API)  |               |  (S3 / Blob)    |
+-------------+               +----------------+
      ^                               ^
      |                               |
  +---+-------------------------------+---+
  |     Global DNS / Anycast / Geo-DNS     |
  +----------------------------------------+
         |         |         |         |
         v         v         v         v
       Edge A    Edge B    Edge C    Edge D
```

Each **Edge POP** handles:

* TLS termination
* HTTP/2 & QUIC parsing
* Caching (RAM + SSD)
* Rate limiting, WAF hooks
* Metrics & logging

---

## ⚙️ Components

### 🧠 Control Plane

* Manages configs, certificates, POP registry, and cache purge APIs.
* APIs:

  * `POST /purge` – Purge by URL or cache key
  * `POST /invalidate` – Pattern invalidation
  * `GET /config` – Fetch edge configuration
  * `POST /origin/register` – Register origin details
* Stores configs in **Postgres or etcd**.
* Includes **ACME client** for certificate management.

### 🌐 Edge Servers (POP)

* Handle connections, caching, and origin fetches.
* Implements **stale-while-revalidate**, **conditional GET**, and **request coalescing**.
* Collects metrics (Prometheus format) and logs (JSON structured).

### 🗂️ Cache System

* **Hot Cache:** In-memory LRU store for small objects.
* **Persistent Cache:** SSD-based for larger assets.
* **Eviction Policy:** LRU (upgradeable to LFU/ARC).
* **Cache Key:**

  ```
  method:host:normalized_path:sorted_query
  ```

### 🛡️ Security

* Edge-level **rate limiting** (per IP, per domain).
* **WAF hooks** for common exploit filtering.
* **DDoS detection** with basic anomaly triggers.
* TLS + HSTS + secure cipher suites.

---

## 📊 Observability

* **Metrics:** Prometheus-compatible `/metrics` endpoint.
* **Logs:** Structured JSON → Elastic / Loki / S3.
* **Dashboards:** Grafana + Alertmanager.
* **Tracing:** Optional Jaeger integration.

---

## 🌍 DNS / Routing

* v1: **Geo-DNS + health-check failover.**
* v2: Add **Anycast (BGP)** routing for faster convergence.

---

## 🧩 APIs

### Purge API Example

```http
POST /v1/purge
Content-Type: application/json

{
  "token": "your_api_key",
  "urls": ["https://cdn.example.com/a.jpg"],
  "hard": true
}
```

**Response:** `202 Accepted` with job ID.

---

## 🧪 Testing & Load Tools

* **Unit tests:** Cache correctness, eviction.
* **Integration tests:** Origin outage simulation, stale revalidation.
* **Load tests:** `wrk2`, `vegeta`, `hey`.
* **Chaos tests:** POP saturation, origin unavailability.

---

## 📦 Deployment & Infrastructure

* **Containerized** (Docker / Kubernetes).
* Each POP runs a fleet behind local load balancer (Nginx or built-in).
* **CI/CD:** Git → Build → Deploy → Rolling updates.
* Supports **Blue/Green deployments**.

---

## 📈 Capacity Planning (Example)

* **Peak egress:** 10 Gbps
* **Edge node:** 1 Gbps
* **Redundancy (x3):** 30 edge instances globally
* **RAM cache:** 16 GB
* **SSD cache:** 1 TB
* **Max object size:** 100 MB

---

## 🧭 Roadmap (v2+)

* Add **Anycast routing** with BGP.
* Implement **hierarchical caching (regional parent POPs)**.
* Support **HTTP/3 (QUIC)** fully.
* Add **edge compute** (Lambda@Edge-style functions).
* Introduce **smart prefetching and ML-based cache warming**.

---

## 🔒 Security & Privacy

* Support **signed URLs / token-based access** for private content.
* **Rotate TLS keys** and protect private key storage.
* **Sanitize logs** (strip cookies/auth headers).

---

## 🧰 Modules

| Module          | Description                                   |
| --------------- | --------------------------------------------- |
| `edge-server`   | Core HTTP listener, cache, metrics            |
| `control-plane` | Configuration, purge API, certificate manager |
| `deploy`        | Deployment scripts for POP provisioning       |
| `observability` | Prometheus exporters, Grafana dashboards      |
| `tests`         | Unit, integration, and load testing tools     |

---

## 📄 License

MIT License