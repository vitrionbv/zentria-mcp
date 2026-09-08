#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./create-server.js";

void serveStdio(createServer);
console.error("zentria-mcp running on stdio");
