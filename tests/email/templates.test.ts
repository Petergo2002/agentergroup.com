import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EMAIL_LOCALES } from "../../src/lib/email/copy.ts";
import { escapeHtml, h, raw, safeUrl } from "../../src/lib/email/html.ts";
import { AUTH_TEMPLATE_IDS, buildAuthTemplates } from "../../src/lib/email/templates/auth.ts";
import { buildInviteEmail } from "../../src/lib/email/templates/invite.ts";
import { buildLeadNotificationEmail } from "../../src/lib/email/templates/lead-notification.ts";
import { resolveEmailAssetOrigin } from "../../src/lib/email/theme.ts";

const ORIGIN = "https://avenro.se";

function invite(overrides: Partial<Parameters<typeof buildInviteEmail>[0]> = {}) {
  return buildInviteEmail({
    workspaceName: "Nordic Bygg AB",
    inviterName: "Peter",
    acceptUrl: `${ORIGIN}/invite/accept?token=abc123`,
    origin: ORIGIN,
    locale: "en",
    ...overrides,
  });
}

function lead(overrides: Partial<Parameters<typeof buildLeadNotificationEmail>[0]> = {}) {
  return buildLeadNotificationEmail({
    widgetName: "Milo",
    lead: { name: "Anna", email: "anna@example.com", phone: "+46 70 123 45 67", message: "Hej!" },
    leadsUrl: `${ORIGIN}/leads`,
    origin: ORIGIN,
    locale: "sv",
    receivedAt: new Date("2026-09-12T09:24:00Z"),
    ...overrides,
  });
}

test("h escapes interpolated values and leaves raw() markup alone", () => {
  assert.equal(h`<p>${"<script>alert(1)</script>"}</p>`, "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.equal(h`<p>${raw("<b>ok</b>")}</p>`, "<p><b>ok</b></p>");
  assert.equal(h`<p>${null}${undefined}${false}</p>`, "<p></p>");
});

test("safeUrl rejects script schemes but keeps Supabase placeholders", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "#");
  assert.equal(safeUrl("data:text/html,<script>"), "#");
  assert.equal(safeUrl("https://avenro.se/x?a=1&b=2"), "https://avenro.se/x?a=1&amp;b=2");
  assert.equal(safeUrl("{{ .ConfirmationURL }}"), "{{ .ConfirmationURL }}");
  assert.equal(safeUrl("mailto:a@b.se"), "mailto:a@b.se");
});

test("lead names and messages cannot inject markup", () => {
  const { html } = lead({
    lead: {
      name: '<img src=x onerror="alert(1)">',
      email: "anna@example.com",
      message: "</td></table><script>alert(2)</script>",
    },
  });

  assert.ok(!html.includes("<script>"));
  // Only the two logo tags — the injected <img> must have been escaped.
  assert.equal(html.split("<img").length - 1, 2);
  assert.ok(!/onerror="alert/.test(html));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
});

test("every email carries a subject, a preheader, a plain-text part and the logo", () => {
  for (const rendered of [invite(), lead()]) {
    assert.ok(rendered.subject.length > 0);
    assert.ok(rendered.text.length > 0);
    assert.ok(rendered.html.includes('class="preheader"'));
    assert.ok(rendered.html.includes(`${ORIGIN}/email/avenro-logo.png`));
    assert.ok(rendered.html.includes(`${ORIGIN}/email/avenro-logo-dark.png`));
    assert.ok(rendered.html.includes("prefers-color-scheme: dark"));
    // Outlook needs the VML button; every other client needs the anchor.
    assert.ok(rendered.html.includes("v:roundrect"));
    assert.ok(rendered.html.includes("<!--[if mso]>"));
  }
});

test("the action URL appears in the button, the fallback and the text part", () => {
  const rendered = invite();
  const acceptUrl = `${ORIGIN}/invite/accept?token=abc123`;
  assert.ok(rendered.html.includes(acceptUrl));
  assert.ok(rendered.text.includes(acceptUrl));
  assert.equal(rendered.html.split(acceptUrl).length - 1, 4);
});

test("lead notifications link the email and phone and localise the timestamp", () => {
  const sv = lead();
  assert.ok(sv.html.includes('href="mailto:anna@example.com"'));
  assert.ok(sv.html.includes('href="tel:+46701234567"'));
  assert.ok(sv.html.includes("11:24"));
  assert.ok(sv.subject.startsWith("Ny förfrågan från Anna"));

  const en = lead({ locale: "en" });
  assert.ok(en.subject.startsWith("New enquiry from Anna"));
});

test("the internal contact-form tag and callback placeholder never reach the reader", () => {
  const tagged = lead({
    lead: { name: "Anna", email: "anna@example.com", message: "[Kontaktformulär] Vill ha offert" },
  });
  assert.ok(!tagged.html.includes("Kontaktformulär]"));
  assert.ok(tagged.html.includes("Vill ha offert"));

  const placeholder = lead({
    lead: { name: "Anna", email: "anna@example.com", message: "Förfrågan om återkoppling" },
  });
  assert.ok(placeholder.html.includes("Besökaren lämnade inget meddelande."));
});

test("Supabase templates keep their Go placeholders intact", () => {
  for (const locale of EMAIL_LOCALES) {
    const templates = buildAuthTemplates(locale, ORIGIN);
    assert.deepEqual(
      templates.map((template) => template.id),
      [...AUTH_TEMPLATE_IDS],
    );

    for (const template of templates) {
      assert.ok(template.subject.length > 0, `${locale}/${template.id} needs a subject`);
      const placeholder = template.id === "reauthentication" ? "{{ .Token }}" : "{{ .ConfirmationURL }}";
      assert.ok(
        template.html.includes(placeholder),
        `${locale}/${template.id} lost ${placeholder}`,
      );
    }
  }
});

test("committed Supabase templates match the current design system", () => {
  for (const locale of EMAIL_LOCALES) {
    for (const template of buildAuthTemplates(locale, "https://avenro.se")) {
      const onDisk = readFileSync(`supabase/templates/${locale}/${template.id}.html`, "utf8");
      assert.equal(
        onDisk,
        `${template.html}\n`,
        `supabase/templates/${locale}/${template.id}.html is stale — run "npm run email:templates"`,
      );
    }
  }
});

test("asset origin falls back to production when the app runs on localhost", () => {
  delete process.env.EMAIL_ASSET_BASE_URL;
  assert.equal(resolveEmailAssetOrigin("http://localhost:3000"), "https://avenro.se");
  assert.equal(resolveEmailAssetOrigin("https://avenro.se/"), "https://avenro.se");

  process.env.EMAIL_ASSET_BASE_URL = "https://staging.avenro.se/";
  assert.equal(resolveEmailAssetOrigin("http://localhost:3000"), "https://staging.avenro.se");
  delete process.env.EMAIL_ASSET_BASE_URL;
});

test("escapeHtml covers every character that can break an attribute", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});
