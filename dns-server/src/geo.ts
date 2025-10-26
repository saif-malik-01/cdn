import pino from "pino";
import maxmind, { type CityResponse } from "maxmind";

const GEO_DB_PATH = process.env["GEO_DB_PATH"] || "";
const logger = pino();

let geoLookup: maxmind.Reader<maxmind.Response> | null = null;
(async () => {
  if (geoLookup) return;
  try {
    geoLookup = await maxmind.open<CityResponse>(GEO_DB_PATH);
    logger.info({ GEO_DB_PATH }, "Loaded GeoIP DB");
  } catch (err) {
    logger.error(
      { err },
      "Failed to open GeoIP DB. Geo lookup will fallback to IP->unknown"
    );
  }
})();

export function lookupRegion(ip: string) {
  if (!geoLookup) return null;
  try {
    const res = geoLookup.get(ip) as any;
    if (!res) return null;
    res;
    if (res.subdivisions && res.subdivisions.length) {
      return res.subdivisions[0].iso_code || res.country.iso_code || null;
    }
    if (res.country && res.country.iso_code) {
      return res.country.iso_code;
    }
    return null;
  } catch (error) {
    logger.error({ error }, "Geo lookup error");
    return null;
  }
}
