# Domain change audit — 6 September 2026

Repository inspection only. No application code, environment values, DNS, provider settings, or database records were changed for this audit. A new domain has not been selected. Live hosting/provider configuration and production data were not inspected; those checks remain pending.

The migration is feasible without recreating the app, Widget V2, or database. Most code edits are straightforward. Coordinating two deployments, authentication, email and incoming webhooks needs an end-to-end check before launch. Losing control of the old domain means redirects and uninterrupted old links cannot be promised.

## Domain layout to decide

One purchased domain is enough. For example, the new root domain can serve this Next.js app (landing page at `/`, dashboard at `/dashboard`) and `widget.<new-domain>` can serve the separate Widget V2 project. An app/dashboard subdomain is also possible.

Existing automation documentation describes a separate marketing deployment and `dashboard.agentergroup.com` as the API host. The repository now includes a landing page in Next.js. Verify the actual hosting layout before choosing origins. All API and webhook URLs must point to the Next.js deployment.

`getSiteOrigin()` currently shares `NEXT_PUBLIC_APP_URL` with the dashboard. If marketing and dashboard use different canonical hosts, introduce a distinct marketing origin and review navigation between them; simply setting the dashboard URL would also change landing-page SEO URLs.

## Confirmed source changes

Paths below are relative to the repository root. Line references reflect the current working tree and may move.

| Location | What needs changing |
| --- | --- |
| `src/lib/site-url.ts:1` | Old marketing origin fallback; affects metadata, canonical URLs, Open Graph, sitemap and robots through callers. |
| `src/components/marketing/LandingPage.tsx:484,493` | Contact link and displayed `info@agentergroup.com`. |
| `src/locales/en/privacyPolicy.ts:84`, `sv/privacyPolicy.ts:84` | Privacy contact email. |
| `src/locales/en/termsOfService.ts:97`, `sv/termsOfService.ts:97` | Terms contact email. |
| `src/lib/email.ts:11`, `.env.example:12` | Default invitation email sender. Configure a verified replacement sender. |
| `src/locales/en/widgetBuilder.ts:148`, `sv/widgetBuilder.ts:148` | Allowed-domain example text. |
| `apps/widget-v2/src/lib/api.ts:36` | Old dashboard/API fallback. |
| `apps/widget-v2/public/loader.js:97,103` | Old widget script fallback and API default, plus examples at the top. |
| `apps/widget-v2/src/Widget.tsx:1297` | Widget branding link to the old website. |
| `apps/widget-v2/src/lib/localization.ts:102` | Old fallback URL used for localization URL parsing. |

Update examples and deployment instructions in `README.md`, `apps/widget-v2/README.md`, `scripts/widget-load-test.mjs`, `docs/architecture/core.md`, `docs/guides/composio-integrations.md`, `docs/guides/automation-agents.md`, and `docs/runbooks/operations.md`.

Do not globally replace the repository directory name, historical audit evidence, or `supabase/config.toml` project label. A domain change does not require changing the Agentergroup/Milo brand name.

## Environment settings and derived URLs

| Deployment | Setting | Required value |
| --- | --- | --- |
| Next.js | `NEXT_PUBLIC_APP_URL` | Chosen HTTPS Next.js app/API origin. |
| Next.js | `NEXT_PUBLIC_WIDGET_APP_URL` | Chosen HTTPS Widget V2 origin. |
| Next.js | `WIDGET_APP_URL` | Legacy fallback: remove if unnecessary, or keep consistent with the public widget setting. |
| Next.js | `EMAIL_FROM_ADDRESS` | Verified replacement sender, once email setup is ready. |
| Widget V2 | `VITE_API_BASE` | Same Next.js API origin as above; rebuild the widget. |

Environment-dependent behavior already exists for workspace invitations, connection authorization links (`/connect/...` and `/connect/callback`), signup confirmation, logout, Stripe checkout/credit purchases/portal return URLs, hosted widget links, embed snippets, preview links/tokens, widget CSP/CORS origin checks, and OpenRouter's referer header. These usually need correct deployment settings and validation rather than separate hardcoded edits. Google login and password reset also construct callback URLs from the browser's current origin.

### Widget V2: the easy-to-miss dependency

Widget V2 is a separate deployment rooted at `apps/widget-v2`, with its own Vite build and `vercel.json`. Deploying Next.js alone does not update it.

The React API resolver accepts `VITE_API_BASE`, but `public/loader.js` is a static public asset with an independent default API URL. Changing that Vite setting alone leaves the loader pointing at the old API. The generated embed snippet in `src/lib/widgets.ts:332` currently supplies only the widget host and public key, with no API override.

When implementing, update both defaults and make the generated snippet pass the supported `data-api-url` explicitly, or introduce a tested build-time loader configuration. Preserve `data-widget` public keys. Test the actual deployed `/loader.js`, standalone chat, customer-site embed and builder preview; testing only the React app would miss this failure.

Preview messaging also checks origins, and new preview tokens include app/widget URLs. Generate fresh preview links after changing configuration. Customer CSP rules may separately need the new script, frame and API origins.

## Account-side work

| Service | Required check/change | Who can handle it |
| --- | --- | --- |
| Domain registrar / DNS | Buy a domain in an account you control; configure the records given by the hosting and email providers. | You purchase/own it; I can guide setup or configure it with authorized access. |
| Hosting (repository documents Vercel) | Confirm the Next.js and Widget V2 projects, attach their respective domains, configure `www` behavior, HTTPS and production/preview environment values; rebuild both projects. Ensure widget assets and public API routes are reachable by visitors. | I can handle deployment work with account access. |
| Supabase Auth | Update production Site URL and permitted redirect URLs for `/auth/callback` and `/auth/confirm`, including the query-bearing flows used by this app. Review confirmation/reset templates and SMTP sender. Local `supabase/config.toml` is not evidence of hosted settings. | I can configure with authorized access, otherwise guide you. |
| Google OAuth | Inspect configured app homepage, privacy/terms links, authorized domains/origins. If using the same Supabase project callback, that provider callback need not change solely because the frontend domain changes. Verify the actual configuration. | Requires the Google project's owner/admin access. |
| Resend / mailbox provider | Verify the new sending domain using its supplied DNS records; update invitation sender and Supabase SMTP sender. Set up a monitored replacement contact address/inbox or forwarding separately. | You choose address/provider; I can assist configuration. |
| Stripe | Update webhook destination to the new Next.js origin plus `/api/billing/webhook`; inspect public business/support URLs. If creating a new endpoint, configure its matching signing secret, separately for test/live. | I can handle with authorized account access. |
| Composio | Update webhook destination to the new Next.js origin plus `/api/composio/webhook`; inspect auth-config app URLs and return URLs. Match the signing secret if webhook configuration changes. | I can handle with authorized account access. |
| Other account settings | Review old-domain email addresses used for service ownership/recovery, plus public profiles, documentation and any analytics/Search Console setup actually in use. | You confirm account ownership and desired replacements. |

Supabase documents the Site URL/redirect allowlist requirements and email-template considerations in its [redirect guide](https://supabase.com/docs/guides/auth/redirect-urls). Resend requires an owned, verified sending domain ([domain documentation](https://resend.com/docs/dashboard/domains/introduction)). Stripe signing secrets belong to individual endpoints ([webhook documentation](https://docs.stripe.com/webhooks)). Vercel supplies deployment URLs and project-specific custom-domain instructions ([domain configuration](https://vercel.com/docs/domains/working-with-domains/add-a-domain)).

Do not replace Supabase's project/storage hostname or Composio's `backend.composio.dev` OAuth callback with the new domain. They belong to the providers. Existing Supabase data, auth users, widget public keys, Stripe products/customers/subscriptions and provider connections can stay in their existing projects/accounts; domain migration alone does not require recreating them.

## Saved data and already-shared links

Production rows have not been queried. Before migration, inventory exact old-domain references in:

- `widgets.privacy_policy_url`: the default is stored when widgets are created (`src/lib/widgets.ts:89,113`), so changing an environment setting does not repair existing values. Update only identified platform-generated old links; preserve customer privacy URLs.
- Widget allowed origins, logos, configured contact URLs/emails, agent definitions and knowledge sources: inspect references and ownership before changing. Customer website allowlists normally remain unchanged.
- Published definitions or documents that contain old platform links: revise/re-publish or re-ingest where applicable. Historical conversation/page-origin records are history and should not be rewritten wholesale.
- Installed embed snippets, standalone widget links, bookmarks, invitations and connection-auth links already shared outside the app: distribute replacement URLs. Merely generating new snippets does not update customer websites.

Browser cookies and storage are origin-bound. Expect users to sign in on the new host and Widget V2 to start a new browser session; this does not delete existing server-side conversations.

Without old-domain control, we cannot guarantee redirects, email forwarding, preservation of old embed URLs or an SEO redirect migration. Customer installations referencing the old widget host need updating. Remove obsolete auth redirect allowlists and stop provider event delivery to the uncontrolled old host as part of the coordinated migration; do not depend on it as a rollback destination.

## Execution order once a domain is selected

1. Confirm domain ownership, account access, chosen app/widget hosts and contact email. Record current settings for recovery and inventory stored old-domain values.
2. Prepare the source/config edits and exact list of data updates. Keep the same database and provider accounts.
3. Configure hosting/DNS and email verification. Set matching Next.js and Widget V2 environment values and deploy both.
4. Configure Supabase redirects/templates, provider URLs and webhook destinations/secrets.
5. Verify landing/canonical/sitemap links; signup, Google sign-in, reset and logout; invitations and integration callbacks; Stripe test checkout/portal/webhook; Composio test delivery; Widget V2 hosted chat, customer embed, preview, lead capture and enabled attachments/actions. Verify customer origin restrictions still reject unapproved sites.
6. Apply reviewed stored-link updates, distribute replacement customer snippets/links, remove obsolete external settings and monitor failures on the new deployments.

Before purchase, development and testing can continue locally. Stable hosting-provided URLs may also be used temporarily after configuring both deployments and auth correctly; this does not by itself solve the old-domain email sender or loader defaults. No domain purchase or live migration has been performed by this audit.
