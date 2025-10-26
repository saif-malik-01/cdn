import db from "./db.js";
import { logger } from "./logger.js";
import type { POP } from "./types.js";

export async function getPopsByRegion(region: string): Promise<POP[] | null> {
  try {
    const res = await db.query(
      "SELECT * FROM pops WHERE region = $1 AND status = 'healthy' ORDER BY latency_ms NULL LAST, id LIMIT 10",
      [region]
    );
    return res.rows;
  } catch (error) {
    logger.error({ error }, "Failed to get pops by region");
    return null;
  }
}

export async function getAllHealthyPops(): Promise<POP[] | null> {
  try {
    const res = await db.query(
      "SELECT * FROM pops WHERE status = 'healthy' ORDER BY latency_ms NULLS LAST, id LIMIT 20"
    );
    return res.rows;
  } catch (error) {
    logger.error({ error }, "Failed to get pops by region");
    return null;
  }
}
