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
  const captureIndex = chatRouteSource.indexOf("autoCaptureLead(supabase");
  const streamIndex = chatRouteSource.indexOf("const stream = new ReadableStream");

  assert.ok(captureIndex >= 0);
  // Capture runs alongside the other pre-model reads, but the turn still waits
  // for it: the background lead summary needs the lead to already exist.
  assert.match(chatRouteSource, /await Promise\.all\(\[\s*autoCaptureLead\(/);
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

test("public widget leads route triggers lead notification email in background handler", () => {
  const publicLeadsSource = readFileSync(
    "src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts",
    "utf8",
  );

  assert.match(publicLeadsSource, /sendLeadNotificationEmail/);
  assert.match(publicLeadsSource, /after\(async \(\) =>/);
});

test("widget v2 integrates contact tab and exports submitWidgetLead", () => {
  const widgetSource = readFileSync("apps/widget-v2/src/Widget.tsx", "utf8");
  const apiSource = readFileSync("apps/widget-v2/src/lib/api.ts", "utf8");
  const contactTabSource = readFileSync(
    "apps/widget-v2/src/components/ContactTab.tsx",
    "utf8",
  );

  assert.match(apiSource, /export async function submitWidgetLead/);
  assert.match(widgetSource, /<ContactTab/);
  assert.match(widgetSource, /activeTab === "contact"/);
  assert.match(contactTabSource, /submitWidgetLead/);
});

test("lead notification email template normalizes to Milo, strips raw tags, and uses brand orange", () => {
  const senderSource = readFileSync("src/lib/email/index.ts", "utf8");
  const templateSource = readFileSync("src/lib/email/templates/lead-notification.ts", "utf8");
  const themeSource = readFileSync("src/lib/email/theme.ts", "utf8");

  // Verify normalization to Milo
  assert.match(senderSource, /Milo/);
  assert.match(senderSource, /maja/i);
  // Verify technical tag stripping
  assert.match(templateSource, /Kontaktformulär/);
  assert.match(templateSource, /replace/);
  // Verify brand orange accent
  assert.match(themeSource, /#ff5c02/);
});

test("leads, analytics and question notifications clear smartly on click and route visit", () => {
  const appShellSource = readFileSync("src/components/layout/AppShell.tsx", "utf8");
  const sidebarSource = readFileSync("src/components/layout/Sidebar.tsx", "utf8");
  const analyticsSource = readFileSync("src/lib/dashboard/analytics.ts", "utf8");
  const enNavSource = readFileSync("src/locales/en/nav.ts", "utf8");
  const svNavSource = readFileSync("src/locales/sv/nav.ts", "utf8");

  // AppShell keeps a seen timestamp per notification surface, workspace scoped.
  assert.match(appShellSource, /agenter_leads_last_seen_at/);
  assert.match(appShellSource, /agenter_analytics_last_seen_at/);
  assert.match(appShellSource, /agenter_questions_last_seen_at/);
  assert.match(appShellSource, /clearLeadsBadge/);
  assert.match(appShellSource, /clearAnalyticsAttention/);
  assert.match(appShellSource, /clearQuestionsBadge/);

  // Counts are gated on that timestamp rather than shown unconditionally.
  assert.match(appShellSource, /effectiveNewLeadCount/);
  assert.match(appShellSource, /effectiveOpenQuestionCount/);

  // Visiting a route marks it seen even when the sidebar item is never clicked.
  assert.match(appShellSource, /if \(!isAnalyticsRoute\) return;/);
  assert.match(appShellSource, /if \(!isLeadsRoute\) return;/);
  assert.match(appShellSource, /if \(!isQuestionsRoute\) return;/);

  // The sidebar hides a badge on the active item, and clears through the item's
  // own callback. Routing it per item rather than by hardcoded href means a new
  // badged destination cannot silently forget to wire clearing up.
  assert.match(sidebarSource, /hasBadge = Boolean\(badgeCount > 0 && !isActive\)/);
  assert.match(sidebarSource, /item\.onSeen\?\.\(\)/);
  assert.match(sidebarSource, /onSeen: onClearLeads/);
  assert.match(sidebarSource, /onSeen: onClearAnalyticsActivity/);
  assert.match(sidebarSource, /onSeen: onClearQuestions/);

  // Each badge describes itself instead of every badge claiming to be leads.
  assert.match(sidebarSource, /badgeLabelKey: "nav\.newLeads"/);
  assert.match(sidebarSource, /badgeLabelKey: "nav\.newQuestions"/);
  assert.match(enNavSource, /newQuestions:/);
  assert.match(svNavSource, /newQuestions:/);

  // The activity payload reports when the newest lead and question arrived, so
  // "is there anything new" is answerable without a second request.
  assert.match(analyticsSource, /latestLeadCreatedAt/);
  assert.match(analyticsSource, /latestQuestionCreatedAt/);

  // Seen timestamps are anchored to the value the server reported, never to the
  // browser clock. Those are different clocks: a client running slow stamps a
  // "seen" time older than an item that already exists, so the badge survives
  // the click and returns on the next poll.
  assert.match(
    appShellSource,
    /markSeenNow\(analyticsStorageKey, latestAnalyticsActivityAt/,
  );
  assert.match(appShellSource, /markSeenNow\(leadsStorageKey, latestLeadCreatedAt/);
  assert.match(
    appShellSource,
    /markSeenNow\(questionsStorageKey, latestQuestionCreatedAt/,
  );
  assert.doesNotMatch(appShellSource, /markSeenNow\([A-Za-z]+StorageKey\)/);

  // The badge entrance is real CSS, and it stands down under reduced motion.
  const globalsSource = readFileSync("src/app/globals.css", "utf8");
  assert.match(globalsSource, /\.sidebar-badge-enter \{/);
  assert.match(
    globalsSource,
    /\.sidebar-badge-enter \{\s*animation: none;/,
  );
});


