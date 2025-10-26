import "dotenv/config";
import dgram from "dgram";
import dnsPacket, { type Answer, type Packet } from "dns-packet";
import { healthCheck } from "./health.js";
import { RCODE } from "./constant.js";
import db from "./db.js";
import { logger } from "./logger.js";
import { lookupRegion } from "./geo.js";
import { getAllHealthyPops, getPopsByRegion } from "./pops.js";
import pickBestPop from "./helper.js";

const HEALTH_INTERVAL_MS = process.env["HEALTH_INTERVAL_MS"];
const LISTEN_ADDR = process.env["LISTEN_ADDR"] || "127.0.0.1";
const LISTEN_PORT = process.env["LISTEN_PORT"] || "5333";
const DNS_TTL = process.env["DNS_TTL"] || 30;

async function resolveDns(ip: string) {
  const region = await lookupRegion(ip);
  if (region) {
    const candidates = await getPopsByRegion(region);
    if (!candidates) return null;
    const best = pickBestPop(candidates);
    return best || null;
  }
  const globalCandidates = await getAllHealthyPops();
  if (!globalCandidates) return null;
  const best = pickBestPop(globalCandidates);
  return best || null;
}

const server = dgram.createSocket("udp4");
server.on("message", async (message, rinfo) => {
  let request;
  try {
    request = dnsPacket.decode(message);
  } catch (err) {
    logger.error({ err }, "Failed to decode DNS request");
    return;
  }
  const response: Packet = {
    type: "response",
    id: request.id,
    flags: 0,
    questions: request.questions,
    answers: [],
  };

  const [question] = request.questions || [];
  if (!question) return;

  const rdBit = (request.flags || 0) & (1 << 8);
  response.flags = (1 << 15) | (1 << 10) | rdBit;
  if (!question) {
    const response = dnsPacket.encode({
      type: "response",
      id: request.id,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [],
    });
    return server.send(response);
  }

  const qname = question?.name;
  const clientIp = rinfo.address;

  try {
    if (qname?.endsWith("cdn.example.com")) {
      const pop = await resolveDns(clientIp);
      if (pop) {
        const isIPv6 = pop.ip_address.includes(":");
        const recordType: "A" | "AAAA" = isIPv6 ? "AAAA" : "A";

        const answer: Answer = {
          name: qname,
          type: recordType,
          class: "IN",
          ttl: Number(DNS_TTL),
          data: pop.ip_address,
        };

        response.answers?.push(answer);
        logger.info(
          { qname, pop: pop.name, ip: pop.ip_address },
          "Answering DNS"
        );
      } else {
        response.flags |= RCODE.SERVFAIL;
        logger.warn({ qname, clientIp }, "No healthy POP found (SERVFAIL)");
      }
    } else {
      response.flags |= RCODE.SERVFAIL;
      logger.warn({ qname, clientIp }, "No healthy POP found (SERVFAIL)");
    }
  } catch (error) {
    response.flags |= RCODE.SERVFAIL;
    logger.error({ error }, "Error resolving DNS");
  }

  try {
    const buf = dnsPacket.encode(response);
    server.send(buf, 0, buf.length, rinfo.port, rinfo.address, (err) => {
      if (err) logger.error({ err }, "Error sending DNS response");
    });
  } catch (err) {
    logger.error({ err }, "Failed to encode/send DNS response");
  }
});

server.on("listening", () => {
  logger.info(`Geo-DNS server listening ${LISTEN_ADDR}:${LISTEN_PORT}`);
});

server.bind(Number(LISTEN_PORT),"0.0.0.0");

setTimeout(healthCheck, Number(HEALTH_INTERVAL_MS));
healthCheck().catch((err) =>
  logger.error({ err }, "Initial health check failed")
);

process.on("SIGINT", async () => {
  logger.info("Shutting down");
  await db.end();
  server.close();
  process.exit(0);
});
