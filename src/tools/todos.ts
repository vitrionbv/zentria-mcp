import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ZentriaClient } from "../zentria/client.js";
import {
  compactBody,
  encodePathSegment,
  paginationQuery,
  paginationSchema,
  registerJsonTool,
} from "./_shared.js";

const todoTranslationsSchema = z
  .record(
    z.string(),
    z.object({
      title: z.string().max(255).describe("Title in this language."),
      description: z.string().max(5000).nullable().optional().describe("Description in this language."),
    }),
  )
  .describe("Title and description per language code, for example { nl: { title: \"Bel de klant\" } }.");

export function registerTodoTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-todos",
    {
      description:
        "List to-dos for the PAT-bound team (GET /api/public/todos). Search with q. Scope: todos:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) =>
      client.request({
        path: "/api/public/todos",
        query: paginationQuery(input),
      }),
  );

  registerJsonTool(
    server,
    "create-todo",
    {
      description:
        "Create a to-do on the PAT-bound team (POST /api/public/todos). Send title and description, or translations per language ({ nl: { title, description }, en: { ... } }); at least one language needs a title. Scope: todos:write.",
      inputSchema: z.object({
        title: z.string().min(1).optional().describe("To-do title (written in the request language)."),
        description: z.string().optional().describe("Optional description."),
        translations: todoTranslationsSchema.optional(),
      }),
    },
    async (input) =>
      client.request({
        method: "POST",
        path: "/api/public/todos",
        body: compactBody(input) ?? {},
      }),
  );

  registerJsonTool(
    server,
    "get-todo",
    {
      description: "Fetch a to-do by id (GET /api/public/todos/{id}). Scope: todos:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("To-do id."),
      }),
    },
    async (input) =>
      client.request({ path: `/api/public/todos/${encodePathSegment(input.id)}` }),
  );

  registerJsonTool(
    server,
    "update-todo",
    {
      description:
        "Update a to-do (PUT /api/public/todos/{id}). Set isCompleted true to complete it (completion webhooks fire) or false to reopen it. With translations, languages you leave out are removed. Scope: todos:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("To-do id."),
        title: z.string().optional().describe("New title."),
        description: z.string().optional().describe("New description."),
        translations: todoTranslationsSchema.optional(),
        isCompleted: z.boolean().optional().describe("true completes the to-do, false reopens it."),
      }),
    },
    async (input) => {
      const { id, ...body } = input;

      return client.request({
        method: "PUT",
        path: `/api/public/todos/${encodePathSegment(id)}`,
        body: compactBody(body) ?? {},
      });
    },
  );

  registerJsonTool(
    server,
    "delete-todo",
    {
      description: "Delete a to-do (DELETE /api/public/todos/{id}). Scope: todos:write.",
      annotations: { destructiveHint: true },
      inputSchema: z.object({
        id: z.number().int().positive().describe("To-do id."),
      }),
    },
    async (input) =>
      client.request({
        method: "DELETE",
        path: `/api/public/todos/${encodePathSegment(input.id)}`,
      }),
  );
}
