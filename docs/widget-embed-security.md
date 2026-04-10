# Widget Embed Security

This widget is designed for local businesses, law firms, and similar customers who need a simple website embed.

## Install model

- customers paste the hosted loader snippet into their site
- no customer backend integration is required
- no customer-issued signed embed token is required
- Agentergroup mints the short-lived widget access token server-side after bootstrap succeeds

## What `allowed_origins` does

- embedded widgets check the browser `Origin` header against the widget's configured `allowed_origins`
- this reduces accidental misuse and low-effort copying of an embed snippet onto unrelated sites
- this is not a hard security boundary against determined scripted clients because the widget still runs in a public browser context

For this product, that tradeoff is intentional: installation stays copy-paste simple for non-technical customers.

## Abuse controls

- public widget POST routes are rate-limited
- rate limiting trusts only edge-supplied client IP headers:
  - `x-vercel-forwarded-for`
  - `cf-connecting-ip`
- requests without a trusted header fall back to the shared `"unknown"` bucket
- widget chat still enforces one active turn per session and returns `409 SESSION_BUSY` on overlap

## Browser and API protections

- the dashboard app sends baseline browser protections through CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`
- widget bootstrap/runtime CORS no longer emits `Access-Control-Allow-Origin: *` together with credentials
- public widget and related runtime APIs return client-safe error messages and codes; internal details stay in server logs
- public lead submission responses are intentionally minimized to `ok`, `leadId`, and `createdAt`

## Follow-up work

These items are intentionally not part of the current launch-hardening batch:

- self-service password reset
- documented backup/restore operator runbook
