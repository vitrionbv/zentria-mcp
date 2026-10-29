# @vitrion/zentria-mcp

[![npm version](https://img.shields.io/npm/v/@vitrion/zentria-mcp.svg)](https://www.npmjs.com/package/@vitrion/zentria-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io/)

**Zentria MCP server** — full [Zentria public team API](https://app.zentria.nl/api/public/docs) coverage for AI assistants via the [Model Context Protocol](https://modelcontextprotocol.io/).

Published as [`@vitrion/zentria-mcp`](https://www.npmjs.com/package/@vitrion/zentria-mcp).

This server uses the official **public REST API** at `/api/public`. Paths and request bodies match the [OpenAPI docs](https://app.zentria.nl/api/public/docs); they are not invented.

## Features

- **309 tools** covering nearly everything the Zentria app does: discovery, to-dos, sales, customers, campaigns and connections, invoices, CRM leads, submissions, calls and lead values, Speed to Lead, Google Business Profiles, webhooks, members, team settings and exports. The hosted connector only lists the tools that fit the scopes of the token
- Team-bound **Personal Access Token** auth (`Authorization: Bearer`)
- Automatic rate-limit retry (429 + `Retry-After`)
- Stdio transport (Cursor, Claude Desktop, Claude Code)
- Hosted **Streamable HTTP** mode with OAuth, used for the Claude custom connector at `https://app.zentria.nl/mcp`
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

## Claude custom connector (hosted)

Zentria hosts this server at `https://app.zentria.nl/mcp`. In Claude (web, Desktop, mobile) choose **Settings → Connectors → Add custom connector**, enter that URL and sign in with your Zentria account. On the consent screen you pick the team and the scopes. No API key is needed.

### Running the HTTP mode

```bash
ZENTRIA_MCP_TRANSPORT=http node dist/index.js
# or
node dist/index.js --http
```

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENTRIA_BASE_URL` | `https://app.zentria.nl` | Zentria origin the tools call |
| `ZENTRIA_MCP_RESOURCE_URL` | `<ZENTRIA_BASE_URL>/mcp` | Public MCP URL, exactly as entered in Claude. Its path is the route served |
| `ZENTRIA_MCP_HOST` | `127.0.0.1` | Listen address |
| `ZENTRIA_MCP_PORT` | `3333` (or `PORT`) | Listen port |

How it works:

- The server is a pure OAuth **resource server**. Zentria (Laravel Passport) is the authorization server and publishes `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server` and dynamic client registration at `/oauth/register`.
- Requests without a valid bearer token get `401` with `WWW-Authenticate: Bearer resource_metadata="…"`, which starts the client's sign-in.
- Tokens are verified with `GET /api/public/me` (cached for 30 seconds) and forwarded unchanged to the public API. Team API keys work as bearer tokens too.
- Each request runs on a fresh stateless server instance. `GET /healthz` answers `{"ok":true}`.

Run it behind a TLS proxy that forwards the MCP path unchanged, for example nginx:

```nginx
location = /mcp {
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_read_timeout 300s;
}
```

## For AI agents

- Call **`get-me`** first to learn the bound team, enabled modules, and token scopes.
- API keys are bound to **one team** — you cannot switch teams with headers.
- Use the narrowest scopes when minting keys (`sales:read`, `sales:write`, etc.).
- Public API docs: [`/api/public/docs`](https://app.zentria.nl/api/public/docs)
- PAT writes can emit webhooks — avoid update loops on the same event.

## Tool groups

343 tools. They cover what you can do in the Zentria app, limited by the rights of the member behind the key and by the scopes of the key. In the hosted connector (HTTP mode) only the tools that fit the scopes of the token are listed, so a read-only connection sees about 110 tools.

| Group | Examples |
|-------|----------|
| **Discovery** | `get-me`, `list-teams`, `get-team`, `list-tenants`, `get-tenant` |
| **To-dos** | `list-todos`, `create-todo`, `get-todo`, `update-todo`, `delete-todo` |
| **Sales** | `list-deals`, `create-deal`, `move-deal-stage`, `delete-deal`, `list-people`, `list-notes`, `create-deal-note`, `list-activities`, `complete-activity`, `list-pipelines`, `create-pipeline`, `create-pipeline-stage`, `list-forms`, `publish-form`, `get-sales-settings` (scopes `sales:read`, `sales:write`, `sales:delete`, `sales-admin:write`) |
| **Customers** | `list-customers`, `create-customer`, `update-customer`, `delete-customer`, `archive-customer`, `restore-customer`, `list-customer-labels`, `merge-customers`, `invite-customer-portal-user`, `get-customer-mollie`, `create-customer-mandate-checkout` |
| **Campaigns and connections** | `list-campaigns`, `create-campaign`, `split-campaign`, `set-campaign-lead-value-categories`, `create-elementor-connection`, `create-mailbox-connection`, `set-campaign-voys`, `list-crm-voys-connections` (passwords and API keys are write-only) |
| **Invoices** | `list-invoices`, `get-invoice`, `mark-invoice-ready`, `cancel-invoice`, `collect-invoice`, `pause-invoice-reminders` (scopes `invoices:read`, `invoices:write`) |
| **CRM leads** | `list-crm-leads` (filters on review status, date, customer, campaign, source, lead value category, invoiced and extra check), `get-crm-lead` (lead value in cents with category label, billing period, invoice and AI summary), `approve-crm-lead`, `reject-crm-lead`, `set-crm-lead-value`, `confirm-crm-lead-rejection`, `delete-crm-lead`, `get-crm-workbench`, `list-crm-callbacks` |
| **CRM submissions and calls** | `list-crm-submissions`, `mark-crm-submission-as-real`, `mark-crm-submission-as-spam`, `retry-crm-submission-processing`, `list-crm-calls`, `get-crm-call` |
| **Lead values and rules** | `list-crm-lead-value-categories`, `create-crm-lead-value-category`, `get-crm-lead-value-settings`, `update-crm-lead-value-settings`, `backfill-crm-lead-values`, `list-crm-learning-rules`, `list-crm-ai-rule-proposals`, `get-crm-dashboard`, `get-crm-customer-report` |
| **Speed to Lead** | `list-stl-flows`, `create-stl-flows-batch`, `list-stl-sms-templates`, `list-stl-leads`, `send-stl-flow-test-sms` |
| **Business Profiles** | `list-business-profile-locations`, `update-business-profile-location`, `list-business-profile-reviews`, `create-business-profile-review-reply`, `create-business-profile-post`, `create-business-profile-post-schedule`, `list-business-profile-photos`, `list-business-profile-accounts`, `create-business-profile-reply-profile` (scopes `business-profiles:read`, `business-profiles:write`, `business-profiles-admin:write`) |
| **CommuniQate (WhatsApp)** | `communiqate-get-connection`, `communiqate-list-channels`, `communiqate-list-templates`, `communiqate-create-template`, `communiqate-search-contacts`, `communiqate-list-conversations`, `communiqate-list-messages`, `communiqate-start-conversation`, `communiqate-send-message`, `communiqate-send-template`, `communiqate-upload-file` (only when the team connected CommuniQate in Zentria; scopes `communiqate:read`, `communiqate:write`, `communiqate-admin:write`) |
| **Mail** | `mail-list-accounts`, `mail-get-account`, `mail-send` (sends a real email from the team's own address, or via Zentria when the team has no own mail account; pass `idempotencyKey` so a retry never sends twice), `mail-get-message`, `mail-list-messages` (scopes `mail:read`, `mail:write`) |
| **Webhooks** | `list-webhooks`, `create-webhook` (secret returned once), `get-webhook-options` |
| **Members and team** | `list-members`, `invite-member`, `change-member-role`, `remove-member`, `list-invitations`, `resend-invitation`, `cancel-invitation`, `list-roles`, `update-team`, `get-settings`, `update-team-setting`, `list-exports`, `start-export`, `delete-export`, `get-integrations` |

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
