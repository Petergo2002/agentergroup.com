/**
 * Renders the Supabase Auth email templates from the shared email design
 * system into `supabase/templates/<locale>/`.
 *
 * Supabase hosts these templates itself, so the generated HTML is committed
 * and pasted into the dashboard (or referenced from `supabase/config.toml`
 * for local development). Run `npm run email:templates` after any design or
 * copy change so the two stay in sync.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EMAIL_LOCALES } from "../src/lib/email/copy.ts";
import { buildAuthTemplates } from "../src/lib/email/templates/auth.ts";

const ORIGIN = process.env.EMAIL_ASSET_BASE_URL?.replace(/\/+$/, "") ?? "https://avenro.se";
const OUT_ROOT = join(process.cwd(), "supabase", "templates");

const subjects: string[] = [];

for (const locale of EMAIL_LOCALES) {
  const dir = join(OUT_ROOT, locale);
  mkdirSync(dir, { recursive: true });

  for (const template of buildAuthTemplates(locale, ORIGIN)) {
    writeFileSync(join(dir, `${template.id}.html`), `${template.html}\n`, "utf8");
    subjects.push(`${locale}/${template.id}  →  ${template.dashboardName}: ${template.subject}`);
  }
}

console.log(`Wrote Supabase Auth templates to supabase/templates (origin: ${ORIGIN})`);
for (const line of subjects) {
  console.log(`  ${line}`);
}
