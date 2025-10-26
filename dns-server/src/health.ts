import db from "./db.js";
import http2 from "http2";
import type { POP } from "./types.js";
import { logger } from "./logger.js";

const HEALTH_PATH = process.env["POP_HEALTH_PATH"];
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

async function checkPOPHealth(pop: POP) {
  const url = `https://${pop.ip_address}:8443${HEALTH_PATH}`;
  const start = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - start;
    const healthy = res.ok && res.status >= 200 && res.status < 300;
    return { healthy, latency: elapsed, statusCode: res.status };
  } catch (error) {
    return { healthy: false, latency: null, err: (error as Error).message };
  }
}

async function healthCheck() {
  const { rows } = await db.query<POP>("SELECT * FROM pops");
  for (const pop of rows) {
    try {
      const { healthy, latency, err } = await checkPOPHealth(pop);
      if (healthy) {
        db.query(
          `UPDATE pops SET status='healthy', latency_ms=$1, updated_at=now() WHERE id=$2`,
          [latency, pop.id]
        );
        logger.info({ pop: pop.name, latency: latency }, "POP healthy");
        return;
      }
      db.query(
        `UPDATE pops SET status='unhealthy', latency_ms=NULL, updated_at=now() WHERE id=$1`,
        [pop.id]
      );
      ``;
      logger.warn({ pop: pop.name, err }, "POP unhealthy");
    } catch (error) {
      logger.error({ error, pop }, "Failed to check/update pop health");
    }
  }
}

export { healthCheck };
