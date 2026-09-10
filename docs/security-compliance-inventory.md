# Security and compliance evidence inventory

Reviewed: 2026-09-10. Scope: the current working tree, including application and widget code, migrations, tests, public legal copy, operational guides, CI, and earlier audits.

## Summary

Avenro has concrete application security controls and privacy workflows that can be described on the landing page. The repository does not establish organization-wide GDPR compliance, SOC 2 attestation, HIPAA compliance, or ISO 27001 certification. The landing page therefore describes implemented features with ordinary Lucide icons, without certification seals or provider credentials presented as Avenro credentials.

This is a source and documentation inventory with local verification, not a production penetration test or independent compliance examination. Production configuration, applied database policies, agreements, retention execution, provider contracts, backup recovery, and organization-level procedures were not independently verified. Historical production checks in earlier reports are not fresh evidence.

## Framework claims

| Framework or claim | Evidence in this repository | Marketing decision |
| --- | --- | --- |
| GDPR | Owner-only public-widget lookup/export/delete, a 180-day retention policy and purge implementation, public privacy policy, processing overview, subprocessor list, operational instructions. | Describe **GDPR privacy tools**, scoped to public chat. Do not claim blanket compliance or certification. |
| SOC 2 Type I / Type II | No Avenro independent auditor report, scope, examination period, or attestation found. | No SOC 2 badge or audit claim. |
| HIPAA | No executed business associate agreements, covered-service scope, HIPAA risk assessment, or end-to-end PHI handling evidence found. | No HIPAA badge or compliance claim. |
| ISO 27001 | No Avenro certificate, certification body, scope, or information security management system evidence found. | No certification claim. |
| EU-only data residency | Privacy policy explicitly allows processing outside the EU/EEA depending on providers and deployment. | No EU-only hosting or residency claim. |
| Encryption / zero retention | Browser transport protections and configurable AI provider privacy preferences exist; these do not establish encryption or zero retention across every service. | No end-to-end encryption, universal AES-256, or blanket zero-retention promise. |

GDPR accountability includes operational and contractual obligations beyond having product controls ([EDPB guidance](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en)). SOC reports result from an examination, and use of SOC logos depends on receiving an appropriate report ([AICPA SOC overview](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services), [AICPA logo guidance](https://webcast.aicpalearningcenter.org/resources/download/soc-for-service-organizations-logo-guidelines-for-service-organization)). HIPAA cloud arrangements require applicable safeguards and business associate agreements; encryption alone does not remove those obligations ([HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html)). Provider compliance does not demonstrate Avenro's own compliance.

## Implemented controls

Paths below are relative to the repository root; line numbers identify reviewed entry points.

| Control | Evidence | Scope / limitation |
| --- | --- | --- |
| Privacy requests | `src/app/api/workspaces/[id]/privacy/dsar/lookup/route.ts:35`, `export/route.ts:33`, `delete/route.ts:32`; `src/lib/privacy.ts:383`; `src/lib/privacy-security.ts:1` | Owners only; normalized exact email or session lookup. Identity verification is an external operating procedure. Public widget coverage, not all platform data. |
| Privacy audit records | Same routes: lookup line 55, export line 53, delete line 81; `src/lib/privacy.ts:767`; `src/lib/runtime/observability.ts:110` | Workspace audit insertions. No claim of immutable, independently monitored, or comprehensive enterprise logging. |
| Retention cleanup | `src/lib/privacy.ts:26`, `:654`; `src/app/api/internal/privacy/retention/route.ts:20`; `docs/guides/privacy-operations.md:50` | 180-day cutoff: sessions use last-seen time, leads use creation time; related data cascades. Includes attachment cleanup. Requires configured secret and an externally scheduled job. |
| Authentication | `src/lib/supabase/proxy.ts:35`, `:143`; `middleware.ts` | Explicit public paths; other matched routes require verified claims. Route-level checks and database policies provide additional authorization. |
| Workspace permissions | `src/lib/workspace-security.ts:11`; workspace/invite/member APIs; `supabase/migrations/20260611203002_production_hardening_security_billing_uploads.sql:1` | Owner/admin checks and workspace scoping; RLS definitions in migrations. Current production policy state is unverified. |
| Private user chats | `supabase/migrations/20260611203002_production_hardening_security_billing_uploads.sql:24` | Assistant and preview conversation policies restrict to the creator and workspace membership. |
| Private chat attachments | `supabase/migrations/20260713183314_critical_authorization_hardening.sql:187`; `20260713184610_guard_widget_attachment_storage_path_uuid.sql:8`; `src/app/api/public/widgets/[widgetPublicKey]/upload/route.ts:290` | Private bucket configuration, membership policies, expiring signed links. Possession of a valid signed link permits access until it expires. |
| Upload validation | `src/lib/widget-attachments.ts:1`, `:100`; public widget upload route | File signatures, extension/MIME checks, size and session limits. These are not antivirus or malware scanning. |
| Public widget abuse controls | `src/lib/rate-limit.ts:64`; `src/lib/widgets/cors-origin.ts:112`; `docs/guides/widget-embed-security.md` | Request limits, signed short-lived widget access tokens, origin configuration, one active chat turn per session. Origin checks are not a boundary against determined scripted clients. |
| Browser protections | `src/lib/security-headers.ts:20`, `:63`; `src/lib/supabase/proxy.ts:96` | Production nonce-based CSP, frame restrictions, MIME-sniffing protection, referrer/permissions policy and HSTS configuration. Does not independently prove all live transport or storage encryption settings. |
| Secret handling | `src/lib/env.ts`; `src/lib/supabase/admin.ts` | Privileged server credentials use server environment variables. This review did not print secrets or dump live configuration. |
| Redirect and remote download controls | `src/lib/auth-redirect.ts`; `src/lib/safe-fetch.ts`; `tests/security/safe-fetch.test.ts` | Local authentication redirect validation; remote-download destination checks and bounded reads. |
| Reduced production debugging data | `src/lib/debug-trace-security.ts:40`; `docs/guides/privacy-operations.md` | Production chat traces and tool payloads are reduced/redacted. Automation activity still stores operational payloads; no blanket claim that sensitive data is never logged. |
| AI provider preferences | `src/lib/env.ts:136`; `src/lib/openrouter.ts:64` | Defaults request `data_collection: deny` and `zdr: true`; environment overrides can change them. Does not cover every integration, model endpoint, stored chat, or provider policy. |
| Webhook verification | `src/app/api/billing/webhook/route.ts:254`; `src/app/api/composio/webhook/route.ts:249` | Stripe and Composio signature verification before handling events. |
| Legal acceptance recording | `src/lib/legal-consent.ts:82` | Signed consent token verification; not a GDPR marketing-consent or cookie-consent management system. |
| CI checks | `.github/workflows/ci.yml` | Root/widget dependency audits, lint, tests, and builds are configured. Configuration is not proof that every production release passed. |

## Evidence gaps by priority

1. **High — unsupported compliance claims.** No organization-level certification/attestation/BAA evidence was found. Such badges could mislead customers evaluating regulated data use. Obtain the actual report or agreement, verify scope and validity, and have the accountable business owner review any future claim. The landing page now explicitly limits its claims.
2. **Medium — incomplete privacy coverage and unverified scheduling.** `docs/guides/privacy-operations.md` documents missing end-to-end DSAR coverage for internal chat, preview chat, and automation payloads. Knowledge uses manual deletion. The retention route exists, but current scheduling, successful runs, backups, and deletion across external processors are unverified. Do not promise that all customer data disappears automatically after 180 days.
3. **Medium — organizational and provider evidence remains incomplete.** The repository's processing page is explanatory copy, not proof of an executed Article 28 agreement. Verify records of processing, lawful bases/notices, international transfer safeguards, requester identity handling, incident processes, provider coverage, backup/recovery tests, and operating responsibilities before broader compliance claims. The displayed subprocessor list contains Supabase, OpenRouter, and Composio; current code also integrates other services (including Stripe, Resend, and Firecrawl), so it should not be presented as an exhaustive verified data-flow inventory.
4. **Medium — earlier security follow-ups remain relevant.** `docs/security_best_practices_report.md` records absence of a centralized Origin/CSRF guard for cookie-authenticated mutations and historical disabled leaked-password protection. No exploit or current production setting was verified in this task. Review those items separately; no security behavior was changed to make marketing claims.
5. **Low — MFA and SSO are not demonstrated product capabilities.** `supabase/config.toml:254` and `:259` disable local TOTP and phone enrollment/verification. No customer SAML/SSO or MFA enforcement workflow was found. Provider support alone does not justify a product badge.
6. **Low — customer compliance links require sign-in.** `src/app/data-processing/page.tsx:4` and `src/app/subprocessors/page.tsx:4` redirect anonymous visitors to login. The new security section links to the genuinely public privacy policy and a contact address. Existing customer documentation routes were not made public or relabeled as a DPA.

## Landing-page implementation

- Six customer-facing features, with descriptive icons, warm brand surfaces, and one/two/three-column layouts.
- English and Swedish content; Security navigation in the header, mobile menu, and footer.
- A GDPR/SOC 2/HIPAA FAQ explains the scope without suggesting independent certification.
- No new third-party scripts, image services, dependencies, tracking, database changes, or production deployment.

## Verification

- All 248 existing tests passed.
- TypeScript checking and ESLint for the changed TypeScript files passed.
- Production build passed. The initial sandboxed compile stalled and was stopped; the normal build completed after an approved execution outside that restriction.
- Browser verification covered English and Swedish rendering, desktop/tablet/mobile layouts (1920/768/390 pixels), six cards with no horizontal overflow, mobile navigation, the expandable compliance FAQ, and anonymous access to the privacy policy. Temporary viewport overrides were reset.
- The changed marketing files pass `git diff --check`. An unrelated existing trailing blank line in `src/lib/knowledge.ts` was left untouched.
- Fresh online dependency audit could not be completed: the sandbox could not resolve npm, and automatic approval review rejected the network-enabled audit because it would send project dependency metadata to the external npm registry without explicit authorization. No workaround was used. Earlier zero-vulnerability audit results remain historical, not current.
