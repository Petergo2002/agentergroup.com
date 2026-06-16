import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractContactFromMessages } from "../../src/lib/widgets/lead-contact.ts";

const chatRouteSource = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const leadsPageSource = readFileSync(
  "src/components/leads/LeadsPageClient.tsx",
  "utf8",
);

test("extracts an email from user messages only", () => {
  assert.deepEqual(
    extractContactFromMessages([
      { role: "assistant", content: "Email example@example.com" },
      { role: "user", content: "You can reach me at PERSON@EXAMPLE.COM" },
    ]),
    {
      name: null,
      email: "person@example.com",
      phone: null,
    },
  );
});

test("extracts standalone local and international phone numbers", () => {
  assert.deepEqual(
    extractContactFromMessages([
      { role: "user", content: "Jag heter Anna och mitt nummer är 070 123 45 67" },
    ]),
    {
      name: "Anna",
      email: null,
      phone: "0701234567",
    },
  );

  assert.equal(
    extractContactFromMessages([
      { role: "user", content: "Call me on +46 (70) 123-4567" },
    ])?.phone,
    "+46701234567",
  );
});

test("does not treat short digit sequences as phone numbers", () => {
  assert.equal(
    extractContactFromMessages([
      { role: "user", content: "My order number is 12345" },
    ]),
    null,
  );
});

test("uses the latest contact details while retaining earlier name context", () => {
  assert.deepEqual(
    extractContactFromMessages([
      { role: "user", content: "My name is Sam." },
      { role: "user", content: "Old email: old@example.com" },
      { role: "user", content: "Use new@example.com and 070-555-12-34" },
    ]),
    {
      name: "Sam",
      email: "new@example.com",
      phone: "0705551234",
    },
  );
});

test("captures leads before starting the assistant stream", () => {
  const captureIndex = chatRouteSource.indexOf("await autoCaptureLead");
  const streamIndex = chatRouteSource.indexOf("const stream = new ReadableStream");

  assert.ok(captureIndex >= 0);
  assert.ok(streamIndex > captureIndex);
  assert.doesNotMatch(chatRouteSource, /void autoCaptureLead/);
});

test("auto-capture reuses the lead tied to the widget session", () => {
  const extractorSource = readFileSync(
    "src/lib/widgets/lead-extractor.ts",
    "utf8",
  );

  assert.match(
    extractorSource,
    /\.eq\("widget_session_id", input\.widgetSessionId\)/,
  );
  assert.match(extractorSource, /\.update\(\{/);
});

test("lead conversation action uses the Analytics session parameter", () => {
  assert.match(leadsPageSource, /\/analytics\?session=/);
  assert.doesNotMatch(leadsPageSource, /\/analytics\?conversation=/);
});
