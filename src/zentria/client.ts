import { PACKAGE_NAME, PACKAGE_VERSION } from "../version.js";
import {
  ZentriaError,
  ZentriaRateLimitError,
  parseRetryAfter,
  zentriaErrorFromResponse,
} from "./errors.js";
import { appendQueryParams } from "./query.js";
import type { ZentriaMeResponse, ZentriaRequestOptions } from "./types.js";

export const DEFAULT_BASE_URL = "https://app.zentria.nl";
export const USER_AGENT = `${PACKAGE_NAME}/${PACKAGE_VERSION}`;

export function normalizeBaseUrl(raw: string): string {
  return raw
    .replace(/\/+$/, "")
    .replace(/\/api\/public$/i, "")
    .replace(/\/api\/v1$/i, "");
}

export interface ZentriaClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class ZentriaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private meCache: ZentriaMeResponse | null = null;

  constructor(options: ZentriaClientOptions = {}) {
    const apiKey =
      options.apiKey ?? process.env.ZENTRIA_API_KEY ?? process.env.ZENTRIA_API_TOKEN;

    if (!apiKey) {
      throw new Error("ZENTRIA_API_KEY environment variable is required");
    }

    this.apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ?? process.env.ZENTRIA_BASE_URL ?? DEFAULT_BASE_URL,
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request(options: ZentriaRequestOptions): Promise<unknown> {
    return this.executeRequest(options, false);
  }

  async getMe(force = false): Promise<ZentriaMeResponse> {
    if (!force && this.meCache) {
      return this.meCache;
    }

    const me = (await this.request({ path: "/api/public/me" })) as ZentriaMeResponse;
    this.meCache = me;

    return me;
  }

  async getBoundTeamId(): Promise<number> {
    const me = await this.getMe();
    const teamId = me.currentTeam?.id;

    if (teamId === undefined || teamId === null) {
      throw new Error("API key is not bound to a team — GET /api/public/me returned no currentTeam.id");
    }

    return teamId;
  }

  private async executeRequest(
    options: ZentriaRequestOptions,
    isRetry: boolean,
  ): Promise<unknown> {
    const method = options.method ?? "GET";
    const path = appendQueryParams(options.path, options.query);
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: options.accept ?? "application/json",
      "User-Agent": USER_AGENT,
    };

    let body: string | undefined;

    if (options.body !== undefined && method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url, { method, headers, body });

    if (response.status === 429 && !isRetry) {
      const retryAfter = parseRetryAfter(response.headers) ?? 1;
      await sleep(retryAfter * 1000);

      return this.executeRequest(options, true);
    }

    if (!response.ok) {
      const errorBody = await readResponseBody(response);

      throw zentriaErrorFromResponse(response.status, errorBody, response.headers);
    }

    if (response.status === 204) {
      return { ok: true };
    }

    return readResponseBody(response);
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { ZentriaError, ZentriaRateLimitError };
