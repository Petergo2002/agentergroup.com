/**
 * Renders every transactional email with sample data so the design can be
 * eyeballed in a browser and pasted into Litmus/Email on Acid.
 *
 * Usage: `npm run email:preview [outDir]` (defaults to `.email-preview`).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EMAIL_LOCALES } from "../src/lib/email/copy.ts";
import { buildAuthTemplates } from "../src/lib/email/templates/auth.ts";
import { buildInviteEmail } from "../src/lib/email/templates/invite.ts";
import { buildLeadNotificationEmail } from "../src/lib/email/templates/lead-notification.ts";

const outDir = process.argv[2] ?? ".email-preview";
const origin = process.env.EMAIL_ASSET_BASE_URL?.replace(/\/+$/, "") ?? "https://avenro.se";

mkdirSync(outDir, { recursive: true });

const written: string[] = [];

/**
 * Inlines the logo files so a preview renders without a running server and can
 * be pasted straight into Litmus or a mail client.
 */
function inlineLogos(html: string): string {
  return html.replace(
    /src="[^"]*\/email\/(avenro-logo(?:-dark)?\.png)"/g,
    (_match, file: string) =>
      `src="data:image/png;base64,${readFileSync(join("public", "email", file)).toString("base64")}"`,
  );
}

function write(name: string, html: string) {
  writeFileSync(join(outDir, `${name}.html`), inlineLogos(html), "utf8");
  written.push(name);
}

for (const locale of EMAIL_LOCALES) {
  const invite = buildInviteEmail({
    workspaceName: "Nordic Bygg AB",
    inviterName: "Peter Gorgees",
    acceptUrl: `${origin}/invite/accept?token=preview-token`,
    origin,
    locale,
  });
  write(`${locale}-invite`, invite.html);

  const lead = buildLeadNotificationEmail({
    widgetName: "Milo",
    lead: {
      name: "Anna Lindqvist",
      email: "anna.lindqvist@example.com",
      phone: "+46 70 123 45 67",
      message:
        "Hej! Vi funderar på att byta fönster i hela fastigheten.\nKan ni höra av er med en offert den här veckan?",
    },
    leadsUrl: `${origin}/leads`,
    origin,
    locale,
    receivedAt: new Date("2026-09-12T09:24:00Z"),
  });
  write(`${locale}-lead`, lead.html);

  for (const template of buildAuthTemplates(locale, origin)) {
    write(`${locale}-auth-${template.id}`, template.html);
  }
}

const index = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Avenro email previews</title>
<style>body{font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:40px;background:#fafaf9;color:#181818}
h1{font-size:20px}a{color:#ff5c02}li{margin:4px 0}</style></head><body>
<h1>Avenro email previews</h1><ul>
${written.map((name) => `<li><a href="./${name}.html">${name}</a></li>`).join("\n")}
</ul></body></html>`;
writeFileSync(join(outDir, "index.html"), index, "utf8");

console.log(`Wrote ${written.length} previews to ${outDir}/ — open ${outDir}/index.html`);
