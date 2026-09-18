import assert from "node:assert/strict";
import test from "node:test";
import {
  groupLeadsByContact,
  normalizePhone,
} from "../../src/lib/leads/group-by-contact.ts";
import type { WidgetLeadListItem } from "../../src/lib/types/widget.ts";

let counter = 0;

function capture(
  overrides: Partial<WidgetLeadListItem> & { created_at: string },
): WidgetLeadListItem {
  counter += 1;
  return {
    id: `lead-${counter}`,
    widget_id: "widget-1",
    widget_session_id: `session-${counter}`,
    widget_agent_id: null,
    agent_id: null,
    name: "Website Visitor",
    email: null,
    phone: null,
    message: null,
    widget_name: "Milo",
    agent_name: "Milo",
    ai_summary: null,
    ...overrides,
  } as WidgetLeadListItem;
}

test("captures from the same email become one contact", () => {
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-06-16T20:23:05Z", email: "p@example.com" }),
    capture({ created_at: "2026-09-17T15:47:43Z", email: "p@example.com" }),
    capture({ created_at: "2026-07-03T21:38:13Z", email: "p@example.com" }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].captureCount, 3);
  assert.equal(groups[0].isReturning, true);
  assert.equal(groups[0].firstSeenAt, "2026-06-16T20:23:05Z");
  assert.equal(groups[0].lastSeenAt, "2026-09-17T15:47:43Z");
});

test("email matching ignores case and surrounding whitespace", () => {
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-09-01T10:00:00Z", email: "P@Example.com" }),
    capture({ created_at: "2026-09-02T10:00:00Z", email: "  p@example.com " }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].captureCount, 2);
});

test("the contact row merges details no single capture holds", () => {
  // The real case from production: four captures, only the newest has a phone,
  // and two of them never produced a name.
  const groups = groupLeadsByContact([
    capture({
      created_at: "2026-06-16T20:23:05Z",
      email: "p@example.com",
      name: "Website Visitor",
    }),
    capture({
      created_at: "2026-09-17T15:47:43Z",
      email: "p@example.com",
      name: "Peter Gorgees",
      phone: "0723220417",
    }),
    capture({
      created_at: "2026-07-03T21:38:13Z",
      email: "p@example.com",
      name: "Website Visitor",
    }),
  ]);

  assert.equal(groups[0].name, "Peter Gorgees");
  assert.equal(groups[0].email, "p@example.com");
  assert.equal(groups[0].phone, "0723220417");
});

test("a newer blank never erases what an earlier capture recorded", () => {
  const groups = groupLeadsByContact([
    capture({
      created_at: "2026-09-01T10:00:00Z",
      email: "p@example.com",
      name: "Peter",
      phone: "0723220417",
    }),
    capture({
      created_at: "2026-09-09T10:00:00Z",
      email: "p@example.com",
      name: "Website Visitor",
    }),
  ]);

  assert.equal(groups[0].name, "Peter");
  assert.equal(groups[0].phone, "0723220417");
});

test("a contact with no name at all reports null rather than the placeholder", () => {
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-09-01T10:00:00Z", email: "p@example.com" }),
  ]);

  assert.equal(groups[0].name, null);
});

test("captures with neither email nor phone stay separate", () => {
  // They are unidentified, not the same person. Keying them all on "" would
  // merge unrelated visitors into one contact.
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-09-01T10:00:00Z" }),
    capture({ created_at: "2026-09-02T10:00:00Z" }),
  ]);

  assert.equal(groups.length, 2);
});

test("phone is the fallback key when there is no email", () => {
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-09-01T10:00:00Z", phone: "072 322 04 17" }),
    capture({ created_at: "2026-09-02T10:00:00Z", phone: "072-3220417" }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].captureCount, 2);
});

test("phone normalisation strips formatting but never guesses a country", () => {
  assert.equal(normalizePhone("072 322 04 17"), "0723220417");
  assert.equal(normalizePhone("(072) 322-0417"), "0723220417");
  assert.equal(normalizePhone("+46 72 322 04 17"), "+46723220417");
  assert.equal(normalizePhone("  "), null);

  // A national and an international form are NOT merged: inferring the country
  // would risk showing one visitor's conversations under another's name.
  assert.notEqual(
    normalizePhone("0723220417"),
    normalizePhone("+46723220417"),
  );
});

test("source channels are counted per contact", () => {
  const groups = groupLeadsByContact([
    capture({
      created_at: "2026-09-01T10:00:00Z",
      email: "p@example.com",
      source_channel: "chat",
    }),
    capture({
      created_at: "2026-09-02T10:00:00Z",
      email: "p@example.com",
      source_channel: "contact_form",
    }),
    capture({
      created_at: "2026-09-03T10:00:00Z",
      email: "p@example.com",
      source_channel: "contact_form",
    }),
  ]);

  assert.equal(groups[0].chatCount, 1);
  assert.equal(groups[0].contactFormCount, 2);
});

test("contacts are ordered by most recent activity, captures newest first", () => {
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-09-01T10:00:00Z", email: "old@example.com" }),
    capture({ created_at: "2026-09-20T10:00:00Z", email: "new@example.com" }),
    capture({ created_at: "2026-09-05T10:00:00Z", email: "old@example.com" }),
  ]);

  assert.deepEqual(
    groups.map((group) => group.email),
    ["new@example.com", "old@example.com"],
  );
  assert.deepEqual(
    groups[1].captures.map((c) => c.created_at),
    ["2026-09-05T10:00:00Z", "2026-09-01T10:00:00Z"],
  );
});

test("the production shape collapses six captures into two contacts", () => {
  const groups = groupLeadsByContact([
    capture({ created_at: "2026-09-17T15:47:43Z", email: "a@example.com", phone: "0723220417", name: "Peter" }),
    capture({ created_at: "2026-09-10T18:45:48Z", email: "a@example.com" }),
    capture({ created_at: "2026-07-03T21:38:13Z", email: "a@example.com" }),
    capture({ created_at: "2026-06-16T20:23:05Z", email: "a@example.com", name: "peter" }),
    capture({ created_at: "2026-09-10T15:46:03Z", email: "b@example.com", name: "Peter G" }),
    capture({ created_at: "2026-09-10T15:35:57Z", email: "b@example.com", name: "Peter G" }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.captureCount),
    [4, 2],
  );
  assert.equal(
    groups.reduce((sum, group) => sum + group.captureCount, 0),
    6,
  );
});
