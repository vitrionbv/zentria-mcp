# @vitrion/zentria-mcp

[![npm version](https://img.shields.io/npm/v/@vitrion/zentria-mcp.svg)](https://www.npmjs.com/package/@vitrion/zentria-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io/)

**Zentria MCP server** — full [Zentria public team API](https://app.zentria.nl/api/public/docs) coverage for AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io/).

Published as [`@vitrion/zentria-mcp`](https://www.npmjs.com/package/@vitrion/zentria-mcp).

This server uses the official **public REST API** at `/api/public`. Paths and request bodies match the [OpenAPI docs](https://app.zentria.nl/api/public/docs); they are not invented.

## Features

- **76 tools** covering discovery, to-dos, sales (people, deals, notes, activities, organizations, pipelines, forms, submissions), customers, CRM, Speed to Lead, webhooks, members, settings, and integrations
- Team-bound **Personal Access Token** auth (`Authorization: Bearer`)
- Automatic rate-limit retry (429 + `Retry-After`)
- Stdio transport (Cursor, Claude Desktop, Claude Code)
- Logs only to stderr (stdio-safe)

## Requirements

- Node.js **>= 20**
- A Zentria team **API key** (Teams → API keys) with the scopes you need

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZENTRIA_API_KEY` | Yes | Team Personal Access Token |
| `ZENTRIA_BASE_URL` | No | Zentria origin (default `https://app.zentria.nl`). Do not append `/api/public`. |

The client also sends `Accept: application/json` and `User-Agent: @vitrion/zentria-mcp/<version>`. The API key is never written to logs.

## Install

```bash
npx -y @vitrion/zentria-mcp
```

### Cursor

Add to your user config (`~/.cursor/mcp.json`) or project config (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "zentria": {
      "command": "npx",
      "args": ["-y", "@vitrion/zentria-mcp"],
      "env": {
        "ZENTRIA_API_KEY": "<team-pat>",
        "ZENTRIA_BASE_URL": "https://app.zentria.nl"
      }
    }
  }
}
```

### Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Use the same `mcpServers` block as Cursor.

### Claude Code

```bash
claude mcp add zentria -- npx -y @vitrion/zentria-mcp
```

Set `ZENTRIA_API_KEY` in your shell environment or MCP host config.

## For AI agents

- Call **`get-me`** first to learn the bound team, enabled modules, and token scopes.
- API keys are bound to **one team** — you cannot switch teams with headers.
- Use the narrowest scopes when minting keys (`sales:read`, `sales:write`, etc.).
- Public API docs: [`/api/public/docs`](https://app.zentria.nl/api/public/docs)
- PAT writes can emit webhooks — avoid update loops on the same event.

## Tool groups

| Group | Examples |
|-------|----------|
| **Discovery** | `get-me`, `list-teams`, `get-team`, `list-tenants`, `get-tenant` |
| **To-dos** | `list-todos`, `create-todo`, `get-todo`, `update-todo`, `delete-todo` |
| **Sales** | `list-deals`, `create-deal`, `move-deal-stage`, `list-people`, `list-notes`, `list-activities`, `list-pipelines`, `get-default-pipeline` |
| **Customers** | `list-customers`, `create-customer`, `archive-customer`, `list-customer-contacts` |
| **CRM** | `list-crm-leads`, `approve-crm-lead`, `reject-crm-lead` |
| **Speed to Lead** | `list-stl-flows`, `list-stl-sms-templates`, `list-stl-leads` |
| **Webhooks** | `list-webhooks`, `create-webhook` (secret returned once) |
| **Members** | `list-members`, `invite-member`, `change-member-role` |
| **Settings** | `get-settings`, `get-integrations` |

## Development

```bash
git clone https://github.com/vitrionbv/zentria-mcp.git
cd zentria-mcp
npm install
npm run build
npm test
npm run dev
```

## Inspector

```bash
npm run build
npm run inspector
```

## Publishing

Releases go to [npm](https://www.npmjs.com/package/@vitrion/zentria-mcp) with [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC). Push a `v*` tag to run [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml). The workflow uses `id-token: write` and does **not** use `NODE_AUTH_TOKEN`.

Configure the trusted publisher on npm: GitHub org `vitrionbv`, repo `zentria-mcp`, workflow `npm-publish.yml`.

## License

MIT — see [LICENSE](LICENSE).

## Links

- [npm: @vitrion/zentria-mcp](https://www.npmjs.com/package/@vitrion/zentria-mcp)
- [GitHub: vitrionbv/zentria-mcp](https://github.com/vitrionbv/zentria-mcp)
- [Zentria public API docs](https://app.zentria.nl/api/public/docs)
- [Zentria n8n community node](https://www.npmjs.com/package/@vitrion/n8n-nodes-zentria)
