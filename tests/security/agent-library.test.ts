import assert from "node:assert/strict";
import test from "node:test";
import {
  applyImportedKnowledgeSourceIds,
  buildContentFromKnowledgeChunks,
  getKnowledgeFolderIdsFromDefinition,
  getKnowledgeSourceIdsFromDefinition,
  getRequiredIntegrationsFromDefinition,
  getToolConnectionsFromDefinition,
  sanitizeBuilderDefinitionForTemplate,
} from "../../src/lib/agent-library.ts";
import type { BuilderDefinition } from "../../src/lib/types/index.ts";

function buildDefinition(): BuilderDefinition {
  return {
    nodes: [
      {
        id: "knowledge",
        data: {
          kind: "knowledge",
          label: "Knowledge",
          sourceIds: ["source-a", "source-b"],
          folderIds: ["folder-a", "folder-b"],
        },
      },
      {
        id: "gmail",
        data: {
          kind: "gmail",
          integrationSlug: "gmail",
          label: "Gmail",
          connectionId: "creator-gmail-connection",
          recipientMode: "manual",
          recipientEmail: "team@example.com",
        },
      },
      {
        id: "calendar",
        data: {
          kind: "googlecalendar",
          integrationSlug: "googlecalendar",
          label: "Calendar",
          connectionId: "creator-calendar-connection",
          calendarId: "creator-calendar",
          calendarLabel: "Creator Calendar",
          timezone: "Europe/Stockholm",
          includePrimaryCalendar: true,
        },
      },
      {
        id: "trigger",
        data: {
          kind: "trigger",
          label: "External Trigger",
          locked: true,
          triggerSource: "gmail_new_message",
          provider: "composio",
          toolkitSlug: "gmail",
          triggerSlug: "GMAIL_NEW_GMAIL_MESSAGE",
          connectionId: "creator-trigger-connection",
          triggerConfig: { labelIds: ["INBOX"] },
        },
      },
    ],
    edges: [],
    config: {
      model: "openai/test",
      instructions: "Answer well.",
      starterPrompts: ["Hello"],
      timezone: "UTC",
      trigger: {
        source: "gmail_new_message",
        provider: "composio",
        toolkitSlug: "gmail",
        triggerSlug: "GMAIL_NEW_GMAIL_MESSAGE",
        connectionId: "creator-trigger-connection",
        triggerConfig: { labelIds: ["INBOX"] },
      },
    },
  };
}

test("sanitizes templates so source connection ids and knowledge ids are not public template state", () => {
  const sanitized = sanitizeBuilderDefinitionForTemplate(buildDefinition());
  const nodes = sanitized.nodes as Array<{ id: string; data: Record<string, unknown> }>;
  const knowledge = nodes.find((node) => node.id === "knowledge")?.data;
  const gmail = nodes.find((node) => node.id === "gmail")?.data;
  const calendar = nodes.find((node) => node.id === "calendar")?.data;
  const trigger = nodes.find((node) => node.id === "trigger")?.data;

  assert.deepEqual(knowledge?.sourceIds, []);
  assert.deepEqual(knowledge?.folderIds, []);
  assert.equal(gmail?.connectionId, null);
  assert.equal(calendar?.connectionId, null);
  assert.equal(calendar?.calendarId, null);
  assert.equal(calendar?.calendarLabel, null);
  assert.equal(calendar?.timezone, null);
  assert.equal(trigger?.connectionId, null);
  assert.deepEqual(trigger?.triggerConfig, {});
  assert.equal(sanitized.config.trigger?.connectionId, null);
  assert.deepEqual(sanitized.config.trigger?.triggerConfig, {});
});

test("extracts selected knowledge and required integrations from builder definitions", () => {
  const definition = buildDefinition();

  assert.deepEqual(getKnowledgeSourceIdsFromDefinition(definition), [
    "source-a",
    "source-b",
  ]);
  assert.deepEqual(getKnowledgeFolderIdsFromDefinition(definition), [
    "folder-a",
    "folder-b",
  ]);
  assert.deepEqual(getRequiredIntegrationsFromDefinition(definition), [
    "gmail",
    "googlecalendar",
  ]);
});

test("extracts per-node tool connections from a builder definition, deduped by connection id", () => {
  const definition = buildDefinition();

  const connections = getToolConnectionsFromDefinition(definition);

  assert.deepEqual(
    connections.sort((a, b) => a.toolkitSlug.localeCompare(b.toolkitSlug)),
    [
      { toolkitSlug: "gmail", connectionId: "creator-gmail-connection" },
      { toolkitSlug: "googlecalendar", connectionId: "creator-calendar-connection" },
    ],
  );

  // Public chat scopes tool access to exactly these published-version
  // connection ids, so a node without a connectionId must never surface.
  const withUnconnectedNode: BuilderDefinition = {
    ...definition,
    nodes: [
      ...(definition.nodes as Array<Record<string, unknown>>),
      {
        id: "slack",
        data: {
          kind: "slack",
          integrationSlug: "slack",
          label: "Slack",
          connectionId: null,
        },
      },
    ],
  };

  assert.equal(
    getToolConnectionsFromDefinition(withUnconnectedNode).some(
      (connection) => connection.toolkitSlug === "slack",
    ),
    false,
  );
});

test("applies imported knowledge source ids to sanitized template definitions", () => {
  const sanitized = sanitizeBuilderDefinitionForTemplate(buildDefinition());
  const imported = applyImportedKnowledgeSourceIds(sanitized, [
    "imported-a",
    "imported-b",
  ]);
  const knowledge = (imported.nodes as Array<{ id: string; data: Record<string, unknown> }>).find(
    (node) => node.id === "knowledge",
  )?.data;

  assert.deepEqual(knowledge?.sourceIds, ["imported-a", "imported-b"]);
  assert.deepEqual(knowledge?.folderIds, []);
});

test("file knowledge snapshots are rebuilt from chunks in stored order", () => {
  assert.equal(
    buildContentFromKnowledgeChunks([
      { chunk_index: 2, content: "Final section" },
      { chunk_index: 0, content: "Intro" },
      { chunk_index: 1, content: "Middle" },
    ]),
    "Intro\n\nMiddle\n\nFinal section",
  );
});
