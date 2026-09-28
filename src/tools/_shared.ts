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
