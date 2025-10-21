import { Agent, fetch as nodeFetch } from "undici";

import { CONFIG } from "../config.js";
import {
  originFetchTotal,
  originErrorsTotal,
  originRetriesTotal,
  originFailuresTotal,
  originFetchLatency,
  originActiveConnections,
  requestCoalescedTotal,
} from "../utils/metrics.js";
import { computeActiveRequests } from "../utils/helpers.js";

interface CahedResponse {
  status: number;
  headers: Headers;
  body: Buffer<ArrayBuffer>;
}

const RETRY_CONFIG = CONFIG.retry;

export class OriginFetcher {
  static _dispatchers = new Map<string, Agent>();
  static _inFlight = new Map<string, Promise<CahedResponse>>();

  static _getDispatcher(baseURL: string): Agent {
    if (this._dispatchers.has(baseURL)) {
      return this._dispatchers.get(baseURL)!;
    }
    const dispatcher = new Agent(CONFIG.agent);
    this._dispatchers.set(baseURL, dispatcher);
    return dispatcher;
  }

  static async _fetchWithRetry(
    url: string,
    headers: Record<string, string>,
    dispatcher: Agent
  ) {
    let attempt = 0;
    originFetchTotal.inc();
    const timer = originFetchLatency.startTimer();

    while (true) {
      try {
        const res = await nodeFetch(url, { headers, dispatcher });
        if (
          RETRY_CONFIG.retryOnHttpError &&
          res.status >= 500 &&
          res.status < 600
        ) {
          throw new Error(`HTTP ${res.status}`);
        }
        timer();
        return res;
      } catch (err) {
        attempt++;
        if (attempt > RETRY_CONFIG.maxRetries) {
          originFailuresTotal.inc();
          originErrorsTotal.inc();
          timer();
          throw err;
        }
        originRetriesTotal.inc();
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  static async fetch(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const baseURL = CONFIG.originUrl;
    const fullURL = baseURL + url;
    const dispatcher = this._getDispatcher(baseURL);

    originActiveConnections.set(computeActiveRequests(dispatcher));

    if (this._inFlight.has(fullURL)) {
      requestCoalescedTotal.inc();
      const cachedResponse = await this._inFlight.get(fullURL)!;
      return new Response(cachedResponse.body.subarray(0), {
        status: cachedResponse.status,
        headers: cachedResponse.headers,
      });
    }

    const resPromise = this._fetchWithRetry(fullURL, headers, dispatcher)
      .then(async (res) => {
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
          status: res.status,
          headers: res.headers,
          body: buffer,
        };
      })
      .finally(() => {
        this._inFlight.delete(fullURL);
      });

    this._inFlight.set(fullURL, resPromise);

    const cached = await resPromise;
    return new Response(cached.body.subarray(0), {
      status: cached.status,
      headers: cached.headers,
    });
  }
}
