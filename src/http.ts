import { createHash } from "node:crypto";
import {
  createServer as createNodeServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  type AuthInfo,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  OAuthError,
  OAuthErrorCode,
  type OAuthTokenVerifier,
  requireBearerAuth,
} from "@modelcontextprotocol/server";
import { createServer } from "./create-server.js";
import { DEFAULT_BASE_URL, normalizeBaseUrl, ZentriaClient } from "./zentria/client.js";
import { ZentriaError } from "./zentria/errors.js";
import type { ZentriaMeResponse } from "./zentria/types.js";

export const DEFAULT_HTTP_PORT = 3333;
export const DEFAULT_HTTP_HOST = "127.0.0.1";
export const TOKEN_CACHE_SECONDS = 30;

export interface HttpServerOptions {
  /** Zentria origin the tools call (`/api/public/*`). */
  baseUrl: string;
  /**
   * Public URL of this MCP endpoint, exactly as entered in the Claude connector dialog
   * (for example `https://app.zentria.nl/mcp`). Its path is the route served here.
   */
  resourceUrl: string;
  fetchImpl?: typeof fetch;
  tokenCacheSeconds?: number;
}

/**
 * Verifies bearer tokens (OAuth access tokens from the Claude connector, or team API keys) by
 * asking Zentria who they belong to. Results are cached briefly so a burst of tool calls costs
 * one lookup; a revoked token stops working within `cacheSeconds`.
 */
export function createZentriaTokenVerifier(options: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  cacheSeconds?: number;
}): OAuthTokenVerifier {
  const cacheSeconds = options.cacheSeconds ?? TOKEN_CACHE_SECONDS;
  const cache = new Map<string, AuthInfo>();

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const key = createHash("sha256").update(token).digest("hex");
      const now = Math.floor(Date.now() / 1000);
      const cached = cache.get(key);

      if (cached?.expiresAt !== undefined && cached.expiresAt > now) {
        return cached;
      }

      let me: ZentriaMeResponse;

      try {
        me = await new ZentriaClient({
          apiKey: token,
          baseUrl: options.baseUrl,
          fetchImpl: options.fetchImpl,
        }).getMe();
      } catch (error) {
        cache.delete(key);

        if (error instanceof ZentriaError && (error.status === 401 || error.status === 403)) {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "The access token is invalid, expired or revoked.");
        }

        throw new OAuthError(OAuthErrorCode.ServerError, "Could not verify the access token with Zentria.");
      }

      const authInfo: AuthInfo = {
        token,
        clientId: "zentria",
        scopes: me.scopes ?? [],
        expiresAt: now + cacheSeconds,
        extra: { me },
      };

      if (cache.size >= 1000) {
        for (const [cachedKey, info] of cache) {
          if ((info.expiresAt ?? 0) <= now) {
            cache.delete(cachedKey);
          }
        }
      }

      cache.set(key, authInfo);

      return authInfo;
    },
  };
}

/**
 * Web-standard handler for the hosted MCP endpoint: `/healthz` for uptime checks, and the MCP
 * route behind bearer auth. Missing or invalid tokens get a `401` with a `WWW-Authenticate`
 * header pointing at the protected resource metadata, which starts Claude's OAuth sign-in.
 * Each request runs on a fresh server instance with an API client for that token.
 */
export function createHttpHandler(options: HttpServerOptions): (request: Request) => Promise<Response> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const resourceUrl = new URL(options.resourceUrl);
  const mcpPath = resourceUrl.pathname.replace(/\/+$/, "") || "/";

  const gate = requireBearerAuth({
    verifier: createZentriaTokenVerifier({
      baseUrl,
      fetchImpl: options.fetchImpl,
      cacheSeconds: options.tokenCacheSeconds,
    }),
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
  });

  const mcp = createMcpHandler(
    (ctx) =>
      createServer({
        client: new ZentriaClient({
          apiKey: ctx.authInfo?.token ?? "",
          baseUrl,
          fetchImpl: options.fetchImpl,
          me: ctx.authInfo?.extra?.me as ZentriaMeResponse | undefined,
        }),
      }),
    {
      onerror: (error) => console.error(`zentria-mcp: ${error.message}`),
    },
  );

  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    if (path === "/healthz") {
      return Response.json({ ok: true });
    }

    if (path !== mcpPath) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const auth = await gate(request);

    if (auth instanceof Response) {
      return auth;
    }

    return mcp.fetch(request, { authInfo: auth });
  };
}

export function httpOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): HttpServerOptions & {
  port: number;
  host: string;
} {
  const baseUrl = normalizeBaseUrl(env.ZENTRIA_BASE_URL ?? DEFAULT_BASE_URL);

  return {
    baseUrl,
    resourceUrl: env.ZENTRIA_MCP_RESOURCE_URL ?? `${baseUrl}/mcp`,
    port: Number(env.ZENTRIA_MCP_PORT ?? env.PORT ?? DEFAULT_HTTP_PORT),
    host: env.ZENTRIA_MCP_HOST ?? DEFAULT_HTTP_HOST,
  };
}

/**
 * Serves the MCP endpoint over plain HTTP on `host:port`, meant to sit behind a TLS-terminating
 * proxy (nginx) that forwards the public MCP path unchanged.
 */
export function startHttpServer(options: HttpServerOptions & { port: number; host: string }): Server {
  const handle = createHttpHandler(options);
  const origin = new URL(options.resourceUrl).origin;

  const server = createNodeServer((req, res) => {
    void toWebRequest(req, origin)
      .then(handle)
      .then((response) => writeWebResponse(response, res))
      .catch((error: unknown) => {
        console.error(`zentria-mcp: ${error instanceof Error ? error.message : String(error)}`);

        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }

        res.end(JSON.stringify({ error: "server_error" }));
      });
  });

  server.listen(options.port, options.host, () => {
    console.error(`zentria-mcp listening on http://${options.host}:${options.port} for ${options.resourceUrl}`);
  });

  return server;
}

async function toWebRequest(req: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = req.method ?? "GET";
  let body: string | undefined;

  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }

    body = Buffer.concat(chunks).toString("utf8");
  }

  const controller = new AbortController();
  req.on("close", () => {
    if (!req.complete) {
      controller.abort();
    }
  });

  return new Request(new URL(req.url ?? "/", origin), {
    method,
    headers,
    body,
    signal: controller.signal,
  });
}

async function writeWebResponse(response: Response, res: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });

  res.writeHead(response.status, headers);

  if (!response.body) {
    res.end();

    return;
  }

  const reader = response.body.getReader();
  res.on("close", () => {
    void reader.cancel().catch(() => undefined);
  });

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    res.write(value);
  }

  res.end();
}
