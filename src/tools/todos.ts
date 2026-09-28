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

export function registerTodoTools(server: McpServer, client: ZentriaClient): void {
  registerJsonTool(
    server,
    "list-todos",
    {
      description:
        "List to-dos for the PAT-bound team (GET /api/public/teams/{teamId}/todos). Scope: todos:read.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({ ...paginationSchema }),
    },
    async (input) => {
      const teamId = await client.getBoundTeamId();

      return client.request({
        path: `/api/public/teams/${encodePathSegment(teamId)}/todos`,
        query: paginationQuery(input),
      });
    },
  );

  registerJsonTool(
    server,
    "create-todo",
    {
      description:
        "Create a to-do on the PAT-bound team (POST /api/public/teams/{teamId}/todos). Scope: todos:write.",
      inputSchema: z.object({
        title: z.string().min(1).describe("To-do title."),
        description: z.string().optional().describe("Optional description."),
        isCompleted: z.boolean().optional().describe("Mark completed on create."),
      }),
    },
    async (input) => {
      const teamId = await client.getBoundTeamId();

      return client.request({
        method: "POST",
        path: `/api/public/teams/${encodePathSegment(teamId)}/todos`,
        body: compactBody(input) ?? {},
      });
    },
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
      description: "Update a to-do (PUT /api/public/todos/{id}). Scope: todos:write.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("To-do id."),
        title: z.string().optional().describe("New title."),
        description: z.string().optional().describe("New description."),
        isCompleted: z.boolean().optional().describe("Completion state."),
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
