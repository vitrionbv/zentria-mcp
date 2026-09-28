import { McpServer } from "@modelcontextprotocol/server";
import { registerCrmTools } from "./tools/crm.js";
import { registerCustomerContactTools } from "./tools/customer-contacts.js";
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

export function createServer(): McpServer {
  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  const client = new ZentriaClient();

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
  registerCustomerContactTools(server, client);
  registerCrmTools(server, client);
  registerStlTools(server, client);
  registerWebhookTools(server, client);
  registerMemberTools(server, client);
  registerSettingsTools(server, client);

  return server;
}
