import { McpServer } from "@modelcontextprotocol/server";
import { registerBusinessProfileTools } from "./tools/business-profiles.js";
import { registerCrmTools } from "./tools/crm.js";
import { registerCrmSettingsTools } from "./tools/crm-settings.js";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerCommuniqateTools } from "./tools/communiqate.js";
import { registerConnectionTools } from "./tools/connections.js";
import { registerCustomerAdminTools } from "./tools/customers-admin.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerMailTools } from "./tools/mail.js";
import { registerStatusTools } from "./tools/status.js";
import { registerSalesAdminTools } from "./tools/sales-admin.js";
import { registerBusinessProfileAdminTools } from "./tools/business-profiles-admin.js";
import { registerTeamAdminTools } from "./tools/team-admin.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerMemberTools, registerSettingsTools } from "./tools/members.js";
import { registerSalesActivityTools } from "./tools/sales-activities.js";
import { registerSalesDealTools } from "./tools/sales-deals.js";
import {
  registerSalesFormTools,
  registerSalesSubmissionTools,
} from "./tools/sales-forms.js";
import { registerSalesNoteTools } from "./tools/sales-notes.js";
import { registerSalesOrganizationTools } from "./tools/sales-organizations.js";
import { registerSalesPeopleTools } from "./tools/sales-people.js";
import { registerSalesPipelineTools } from "./tools/sales-pipelines.js";
import { registerStlTools } from "./tools/stl.js";
import { registerTodoTools } from "./tools/todos.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";
import { ZentriaClient } from "./zentria/client.js";

export interface CreateServerOptions {
  /** API client to use. Defaults to one built from `ZENTRIA_API_KEY` (stdio mode). */
  client?: ZentriaClient;
  /**
   * Scopes of the token. When given and not empty, tools whose description names scopes
   * (`Scope: crm:read.`) are only registered if the token has one of them. Tools that name
   * no scope are always registered. Leave it out to register every tool.
   */
  scopes?: readonly string[];
}

const SCOPE_PATTERN = /\b[a-z][a-z-]*:(?:read|write|delete)\b/g;

/** Scopes named after "Scope:" or "Scopes:" in a tool description, or none when it names none. */
export function scopesNamedIn(description: unknown): string[] {
  if (typeof description !== "string") {
    return [];
  }

  const start = description.search(/\bScopes?\b:?\s/);

  if (start < 0) {
    return [];
  }

  return description.slice(start).match(SCOPE_PATTERN) ?? [];
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  const client = options.client ?? new ZentriaClient();

  if (options.scopes && options.scopes.length > 0) {
    const granted = new Set(options.scopes);
    const register = server.registerTool.bind(server) as (...args: unknown[]) => unknown;

    (server as unknown as { registerTool: (...args: unknown[]) => unknown }).registerTool = (
      name: unknown,
      config: unknown,
      handler: unknown,
    ) => {
      const named = scopesNamedIn((config as { description?: unknown } | undefined)?.description);

      if (named.length > 0 && !named.some((scope) => granted.has(scope))) {
        return undefined;
      }

      return register(name, config, handler);
    };
  }

  registerDiscoveryTools(server, client);
  registerTodoTools(server, client);
  registerSalesPeopleTools(server, client);
  registerSalesDealTools(server, client);
  registerSalesNoteTools(server, client);
  registerSalesActivityTools(server, client);
  registerSalesOrganizationTools(server, client);
  registerSalesPipelineTools(server, client);
  registerSalesFormTools(server, client);
  registerSalesSubmissionTools(server, client);
  registerCustomerTools(server, client);
  registerCrmTools(server, client);
  registerStlTools(server, client);
  registerBusinessProfileTools(server, client);
  registerWebhookTools(server, client);
  registerMemberTools(server, client);
  registerSettingsTools(server, client);
  registerCrmSettingsTools(server, client);
  registerCampaignTools(server, client);
  registerCommuniqateTools(server, client);
  registerConnectionTools(server, client);
  registerCustomerAdminTools(server, client);
  registerInvoiceTools(server, client);
  registerMailTools(server, client);
  registerStatusTools(server, client);
  registerSalesAdminTools(server, client);
  registerBusinessProfileAdminTools(server, client);
  registerTeamAdminTools(server, client);

  return server;
}
