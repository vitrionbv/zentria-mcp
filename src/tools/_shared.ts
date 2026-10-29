import type { McpServer } from "@modelcontextprotocol/server";
import type { ZodTypeAny } from "zod/v4";
import * as z from "zod/v4";
import { ZentriaError } from "../zentria/errors.js";

export function jsonResult(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

export function errorResult(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  if (error instanceof ZentriaError) {
    const payload: Record<string, unknown> = {
      status: error.status,
      message: error.message,
    };

    if (error.details !== undefined) {
      payload.details = error.details;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export function compactBody(
  record: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function encodePathSegment(value: string | number): string {
  return encodeURIComponent(String(value));
}

export const paginationSchema = {
  q: z.string().optional().describe("Search query."),
  page: z.number().int().min(1).optional().describe("Page number (default 1)."),
  itemsPerPage: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Items per page (default 25, max 100)."),
};

export const idSchema = z.number().int().positive().describe("Resource id.");

type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export function registerJsonTool<T extends ZodTypeAny>(
  server: McpServer,
  name: string,
  options: {
    description: string;
    inputSchema: T;
    annotations?: ToolAnnotations;
  },
  handler: (input: T["_output"]) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    options as unknown as Parameters<McpServer["registerTool"]>[1],
    async (input) => {
      try {
        return jsonResult(await handler(input as T["_output"]));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

export function paginationQuery(input: {
  q?: string;
  page?: number;
  itemsPerPage?: number;
}): Record<string, string | number> {
  const query: Record<string, string | number> = {};

  if (input.q) {
    query.q = input.q;
  }

  if (input.page !== undefined) {
    query.page = input.page;
  }

  if (input.itemsPerPage !== undefined) {
    query.itemsPerPage = input.itemsPerPage;
  }

  return query;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiToolSpec<T extends z.ZodRawShape> {
  /** kebab-case tool name. */
  name: string;
  /** What it does, which endpoint it calls and the scope it needs (see the other tools). */
  description: string;
  method?: HttpMethod;
  /** API path. `{key}` placeholders are filled from the input and URL-encoded. */
  path: string;
  /** Zod raw shape of the tool input. */
  input: T;
  /**
   * Input keys sent as query string. Without this list every key that is not in the path
   * goes to the query string for GET and to the JSON body for other methods.
   */
  query?: Array<keyof T & string>;
  /** Map an input key to a different API field or query name, for example `{ firstSeenAfter: "firstSeenAt[after]" }`. */
  rename?: Partial<Record<keyof T & string, string>>;
  /** Send these input keys as request headers instead, for example `{ idempotencyKey: "Idempotency-Key" }`. */
  headers?: Partial<Record<keyof T & string, string>>;
  /** Defaults to true for GET. */
  readOnly?: boolean;
  /** Mark tools that delete or irreversibly change data. */
  destructive?: boolean;
}

/**
 * Register a tool that maps its input onto one public API call. Use this for plain
 * list, get, create, update, delete and action endpoints.
 */
export function registerApiTool<T extends z.ZodRawShape>(
  server: McpServer,
  client: {
    request(options: {
      method?: HttpMethod;
      path: string;
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
      headers?: Record<string, string>;
    }): Promise<unknown>;
  },
  spec: ApiToolSpec<T>,
): void {
  const method = spec.method ?? "GET";
  const pathKeys = new Set(Array.from(spec.path.matchAll(/\{(\w+)\}/g), (match) => match[1]));
  const queryKeys = spec.query ? new Set<string>(spec.query) : null;

  registerJsonTool(
    server,
    spec.name,
    {
      description: spec.description,
      annotations: {
        readOnlyHint: spec.readOnly ?? method === "GET",
        ...(spec.destructive ? { destructiveHint: true } : {}),
      },
      inputSchema: z.object(spec.input),
    },
    async (input: Record<string, unknown>) => {
      const query: Record<string, string | number | boolean | undefined | null> = {};
      const body: Record<string, unknown> = {};
      const headers: Record<string, string> = {};
      let path = spec.path;

      for (const [key, value] of Object.entries(input)) {
        if (pathKeys.has(key)) {
          path = path.replace(`{${key}}`, encodePathSegment(value as string | number));
          continue;
        }

        if (value === undefined) {
          continue;
        }

        const header = (spec.headers as Record<string, string> | undefined)?.[key];

        if (header) {
          headers[header] = String(value);
          continue;
        }

        const target = (spec.rename as Record<string, string> | undefined)?.[key] ?? key;
        const toQuery = queryKeys ? queryKeys.has(key) : method === "GET";

        if (toQuery) {
          query[target] = value as string | number | boolean;
        } else {
          body[target] = value;
        }
      }

      return client.request({
        method,
        path,
        query: Object.keys(query).length > 0 ? query : undefined,
        body: method === "GET" ? undefined : body,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      });
    },
  );
}
