# Security Best-Practices Review

Reviewed: 2026-08-08

## Executive summary

The application, widget runtime, and linked Supabase project were reviewed for
authentication, authorization, tenant isolation, secret handling, injection
sinks, redirect handling, browser security headers, dependencies, and
production schema drift. One production authorization weakness was confirmed
in the deployed knowledge processor: it did not match the hardened repository
implementation. Supabase Edge Function version 13 is now active and its three
files exactly match the repository. Root and widget dependency audits now
report zero vulnerabilities.

No destructive database changes or data migrations were required. All 93 local
migrations match the linked production history. All inspected public tables
have RLS enabled.

## Resolved findings

### High — deployed knowledge processor lagged behind authorization hardening

The previous production function loaded a supplied knowledge-source UUID with
an admin client before enforcing workspace-scoped access. The deployed version
now authenticates a user and performs the source lookup through the
user-scoped client/RLS before privileged processing
(`supabase/functions/process-knowledge-source/index.ts:202`). Internal calls
must present a configured server secret
(`supabase/functions/process-knowledge-source/index.ts:174`).

The same deployment rejects missing authentication, constrains selected crawl
URLs to the original website origin, caps them at 30 pages, derives plan limits
server-side, and uses the existing atomic storage-reservation RPC
(`supabase/functions/process-knowledge-source/index.ts:69` and
`supabase/functions/process-knowledge-source/index.ts:260`).

### High — vulnerable dependency tree

The initial audit reported vulnerable Next.js/transitive packages in the root
and PostCSS/Nanoid paths in the widget. Compatible package updates plus reviewed
`brace-expansion` and `js-yaml` overrides reduced both package audits to
zero reported vulnerabilities. No forced downgrade or unrelated major
framework migration was used.

### Low — environment inventory omitted an active production flag

`NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED` is now present in `.env.example`
and the setup documentation. It defaults to managed-plan activation and must be
exactly `true` to expose self-service billing.

### Low — unreferenced mutation paths

Three unused legacy server-action modules were removed. They duplicated current
API flows and included broad record updates; no repository references remained.

### Low — authentication redirects discarded cookie cleanup

When Supabase rejected a stale refresh token, the middleware queued deletion of
the dead session cookie but returned a newly created redirect response without
copying those cookie changes. The redirect now preserves Supabase refresh and
removal cookies (`src/lib/supabase/proxy.ts:146`). A synthetic expired-session
request verified a `307` login redirect with the auth-cookie deletion header.

### Medium — Drive imports buffered unbounded provider responses

Google Drive imports previously buffered remote provider responses before
checking the workspace storage limit. Remote reads now stop at the workspace's
remaining knowledge-storage allowance and have a 30-second timeout
(`src/lib/safe-fetch.ts` and `src/app/api/knowledge/drive/import/route.ts`).
Declared and streamed oversize responses are both rejected before upload.

The import path also no longer logs raw provider payloads or URL candidates,
which may contain short-lived signed credentials. Regression tests cover both
bounded streaming and the logging contract.

## Confirmed controls

- Middleware uses an explicit-public/default-auth model and redirects every
  other matched route when no verified Supabase claims exist
  (`src/lib/supabase/proxy.ts:30` and `src/lib/supabase/proxy.ts:143`).
- Privileged Supabase keys are read only from server variables; public clients
  receive only URL and publishable-key values (`src/lib/env.ts:21` and
  `src/lib/env.ts:51`).
- Login and callback destinations reject absolute/protocol-relative redirects
  and auth-loop targets (`src/lib/auth-redirect.ts:8`).
- Production responses receive a nonce-based CSP, HSTS, clickjacking,
  MIME-sniffing, referrer, and permissions protections
  (`src/lib/security-headers.ts:20` and
  `src/lib/security-headers.ts:63`).
- No application use of `eval`, `new Function`,
  `dangerouslySetInnerHTML`, or direct `innerHTML` assignment was found.
- No tracked environment file or credential-shaped secret was found. The local
  environment file remains ignored and was not printed or modified.
- The production-generated schema is committed as
  `src/lib/supabase/database.types.ts` for migration/type drift review.

## Remaining items

### Medium — no application-wide Origin/CSRF guard for cookie-authenticated mutations

Protected mutation routes rely on authenticated Supabase cookies, their
SameSite behavior, route-level authorization, and RLS. There is no single
middleware-level Origin/CSRF check. Adding one can reject legitimate
service-to-service or cross-origin callers, so it requires a caller inventory,
staging validation, and explicit approval before changing production behavior.

### Accepted configuration — leaked-password protection

Supabase reports that leaked-password protection is disabled. The project owner
explicitly chose to leave it disabled; no change was made.

### Informational — RLS-enabled tables with no policies

Supabase reports four RLS-enabled/no-policy tables:
`private.agent_creation_requests`,
`private.agent_template_import_requests`,
`public.agent_automation_activation_intents`, and
`public.agent_automation_provider_outbox`. They are intentionally
deny-by-default and accessed through trusted server/database paths. Adding
client policies would broaden access and was not warranted.

### Informational — performance advisors

The linked project reports unused indexes, unindexed foreign keys, and two
permissive `agents` update policies during a rollout. These are not confirmed
security defects. Index removal or policy consolidation should wait for
representative production query/policy evidence because speculative changes
could regress performance or access behavior.
