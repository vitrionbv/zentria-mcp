#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./create-server.js";
import { httpOptionsFromEnv, startHttpServer } from "./http.js";

if (process.argv.includes("--http") || process.env.ZENTRIA_MCP_TRANSPORT === "http") {
  startHttpServer(httpOptionsFromEnv());
} else {
  void serveStdio(() => createServer());
  console.error("zentria-mcp running on stdio");
}
