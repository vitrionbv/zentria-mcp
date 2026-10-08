import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./create-server.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";

const EXPECTED_TOOLS = [
  "get-me",
  "list-teams",
  "get-team",
  "list-tenants",
  "get-tenant",
  "list-todos",
  "create-todo",
  "get-todo",
  "update-todo",
  "delete-todo",
  "list-people",
  "create-person",
  "get-person",
  "update-person",
  "list-deals",
  "create-deal",
  "get-deal",
  "update-deal",
  "move-deal-stage",
  "list-notes",
  "create-note",
  "get-note",
  "update-note",
  "delete-note",
  "list-activities",
  "create-activity",
  "get-activity",
  "update-activity",
  "list-organizations",
  "create-organization",
  "get-organization",
  "update-organization",
  "list-pipelines",
  "get-pipeline",
  "get-default-pipeline",
  "list-forms",
  "create-form",
  "get-form",
  "update-form",
  "list-form-submissions",
  "get-form-submission",
  "list-customers",
  "create-customer",
  "get-customer",
  "update-customer",
  "archive-customer",
  "restore-customer",
  "list-customer-contacts",
  "create-customer-contact",
  "get-contact",
  "update-contact",
  "list-crm-leads",
  "get-crm-lead",
  "approve-crm-lead",
  "reject-crm-lead",
  "list-crm-submissions",
  "get-crm-submission",
  "list-stl-flows",
  "create-stl-flow",
  "get-stl-flow",
  "update-stl-flow",
  "delete-stl-flow",
  "list-stl-sms-templates",
  "create-stl-sms-template",
  "get-stl-sms-template",
  "update-stl-sms-template",
  "delete-stl-sms-template",
  "list-stl-leads",
  "get-stl-lead",
  "delete-stl-lead",
  "list-business-profile-locations",
  "get-business-profile-location",
  "list-business-profile-reviews",
  "dismiss-business-profile-review",
  "restore-business-profile-review",
  "list-business-profile-review-replies",
  "approve-business-profile-review-reply",
  "reject-business-profile-review-reply",
  "list-business-profile-changes",
  "accept-business-profile-change",
  "dismiss-business-profile-change",
  "reject-business-profile-change",
  "list-business-profile-posts",
  "create-business-profile-post",
  "delete-business-profile-post",
  "get-location-performance",
  "list-location-search-keywords",
  "list-webhooks",
  "create-webhook",
  "get-webhook",
  "update-webhook",
  "delete-webhook",
  "list-members",
  "get-member",
  "invite-member",
  "change-member-role",
  "get-settings",
  "get-integrations",
];

describe("createServer", () => {
  beforeEach(() => {
    process.env.ZENTRIA_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ZENTRIA_API_KEY;
  });

  it("creates a server with the package identity", () => {
    const server = createServer();
    expect(server).toBeTruthy();
    const info = (
      server as unknown as { serverInfo?: { name: string; version: string } }
    ).serverInfo;
    if (info) {
      expect(info.name).toBe(PACKAGE_NAME);
      expect(info.version).toBe(PACKAGE_VERSION);
    }
  });

  it("registers kebab-case tools for every public API operation", () => {
    const server = createServer();
    const tools = listRegisteredToolNames(server);
    expect(tools.sort()).toEqual([...EXPECTED_TOOLS].sort());
    for (const name of tools) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

function listRegisteredToolNames(server: unknown): string[] {
  const candidate = server as {
    _registeredTools?: Record<string, unknown>;
    _tools?: Record<string, unknown>;
    tools?: Map<string, unknown> | Record<string, unknown>;
  };

  if (candidate._registeredTools) {
    return Object.keys(candidate._registeredTools);
  }
  if (candidate._tools) {
    return Object.keys(candidate._tools);
  }
  if (candidate.tools instanceof Map) {
    return [...candidate.tools.keys()];
  }
  if (candidate.tools && typeof candidate.tools === "object") {
    return Object.keys(candidate.tools);
  }

  throw new Error("Unable to inspect registered MCP tools");
}
