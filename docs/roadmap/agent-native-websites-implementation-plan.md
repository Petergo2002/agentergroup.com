# Agent Sites on Widget V2: Implementation Plan

Last updated: 2026-08-12

Status: Proposed implementation sequence; awaiting approval; no application implementation is authorized by this document

Parent roadmap: [Agent Sites on Widget V2](./agent-native-websites.md)

Current-product relationship: Milo and Website Chat are already implemented. This proposed plan extends that same primary Milo into a native Agent Site delivery mode; it does not authorize a second agent, a second Website Chat, or a parallel conversation runtime.

## 1. Purpose

This document converts the product roadmap into dependency-ordered phases that can be implemented, verified, released, and rolled back independently.

The implementation must evolve the architecture already in production:

- existing `widgets` and `widget_agents`
- existing hosted and embedded Widget V2
- existing public Widget APIs
- existing Builder, published versions, Knowledge, and Connections
- existing widget sessions, messages, leads, analytics, and Questions/Data Flywheel

It must not create a parallel Agent Site product model.

## 2. Implementation Outcome

When the mandatory phases are complete, an operator can:

1. open the existing Website Chat area
2. configure Website Chat and its attached primary Milo
3. enable an Agent Site, a Chat Widget, or both
4. edit approved universal site content and SEO settings
5. preview and publish safely
6. use a platform URL
7. optionally connect a verified custom domain
8. see conversations, leads, analytics, and knowledge gaps by delivery channel
9. improve the same Milo intelligence for both delivery modes

The public Agent Site will:

- server-render approved, crawlable business content
- load the existing Widget V2 chat runtime
- use the existing public Widget APIs
- remain useful when chat or JavaScript fails
- preserve existing embed behavior

## 3. Number of Phases

There are **seven mandatory phases**, numbered Phase 0 through Phase 6:

0. Confirm and protect the foundation
1. Shared delivery foundation
2. SEO-ready Agent Site
3. Website Chat & Agent Site management UI
4. Custom domains
5. Analytics and governed improvement
6. Hardening and limited launch

Phase 7 is optional earned expansion and is not part of the initial implementation commitment.

Do not start a later phase because an earlier phase appears visually complete. Each phase ends only when its verification gate passes.

## 4. Critical-Path Decision

The implementation order is:

> Characterize the current Widget system -> freeze the shared channel contract -> add a safe site publication model -> build the server-rendered platform URL -> compose Widget V2 into it -> evolve the current Widget UI -> add custom domains -> connect analytics and governed improvement -> harden and release gradually.

This order protects the working embed and standalone runtime while adding one capability at a time.

The implementation does **not** begin with:

- a new sidebar
- a Chatbase-style global launcher
- a new agent kind
- a replacement for Widget V2
- a full visual site builder
- custom domains
- destructive database cleanup

## 5. Architecture Contract

### 5.1 Canonical ownership

The existing Widget deployment remains the owner of both customer-facing delivery modes.

| Concern | Canonical owner |
| --- | --- |
| Agent behavior | `agents`, `agent_drafts`, `agent_versions` |
| Deployment identity | `widgets` |
| Attached agents and deployed versions | `widget_agents` |
| Shared appearance | existing Widget fields, extended only when necessary |
| Agent Site draft/publication | additive widget-owned site records |
| Chat runtime | `apps/widget-v2` |
| Public APIs | `src/app/api/public/widgets/[widgetPublicKey]/*` |
| Sessions and messages | `widget_sessions`, `widget_session_messages` |
| Leads | `widget_leads` |
| Channel attribution | current session `source`: `hosted` or `embedded` |
| Knowledge and improvement | existing Knowledge and Questions/Data Flywheel |
| External capabilities | existing Connections and agent connection selection |

### 5.2 Delivery mapping

- Agent Site uses the current `hosted` source semantics.
- Chat Widget uses the current `embedded` source semantics.
- Operator preview uses the current `preview` semantics.

Customer-facing UI may display “Agent Site” instead of “Hosted,” but existing database values should not be renamed merely for presentation.

### 5.3 Runtime split

The main Next.js application owns the server-rendered public document and public routing.

Widget V2 owns the interactive conversation.

The Next.js Agent Site may isolate the Widget V2 client in an iframe or equivalent mounting boundary, but the whole page must not be an iframe-only wrapper. Approved supporting content, metadata, fallback, privacy, and contact content are rendered by Next.js.

### 5.4 Compatibility promise

The following remain valid throughout the project:

- current widget ids
- current widget public keys
- existing hosted URLs until an explicit redirect decision
- existing embed snippets
- allowed origins
- current agent/widget relationships
- current sessions, messages, leads, and analytics history
- existing preview flow
- current Widget V2 separate deployment
- Automation behavior

## 6. Delivery Rules for Every Work Package

Every future implementation work package must:

1. confirm the relevant roadmap decision and current worktree state
2. add or update characterization tests first
3. use additive schema changes before application cutover
4. enforce authorization on the server and database, not only in UI
5. keep public API responses field-allowlisted
6. preserve existing Widget V2 contracts
7. build and test both the Next.js app and `apps/widget-v2` when shared contracts change
8. deploy dormant or disabled by default
9. enable only for an explicit internal/test widget first
10. exercise rollback before widening rollout
11. update architecture/runbook documentation only after behavior is verified

No work package is complete because a screen renders locally.

## 7. Dependency Graph

```text
Phase 0
  WP-0A Current-state inventory
    -> WP-0B Contract decisions
    -> WP-0C Characterization and release baseline

Phase 1
  WP-1A Channel and launch contract
    -> WP-1B Shared public runtime compatibility
    -> WP-1C Internal end-to-end foundation gate

Phase 2
  WP-2A Widget-owned site schema
    -> WP-2B Draft/publication services
    -> WP-2C Server-rendered platform route
    -> WP-2D Widget V2 site composition
    -> WP-2E SEO, accessibility, and fallback gate

Phase 3
  WP-3A Website Chat & Agent Site information architecture
    -> WP-3B Agent Site and Content/SEO management
    -> WP-3C Chat Widget and shared configuration
    -> WP-3D Preview, publish, and deployment UX

Phase 4
  WP-4A Domain control-plane contract
    -> WP-4B Verification, routing, and TLS
    -> WP-4C Domain UI and operational gate

Phase 5
  WP-5A Channel-aware analytics
    -> WP-5B Governed FAQ/public-content promotion
    -> WP-5C Improvement validation

Phase 6
  WP-6A Security and privacy hardening
    -> WP-6B Performance, accessibility, and resilience
    -> WP-6C Staged limited launch

Phase 7
  Evidence from Phase 6 -> separately approved expansion packages
```

## 8. Phase 0 — Confirm and Protect the Foundation

### Goal

Freeze the correct architecture and prove current behavior before any application or database change.

### WP-0A — Current-State Inventory

#### Work

Document and verify:

- current `widgets` and `widget_agents` fields and constraints
- current single-agent and multi-agent widget records
- current hosted and embedded bootstrap rules
- current Widget V2 hosted, embedded, and preview URLs
- current public API request/response contracts
- current deployment, `deployed_at`, published-version snapshot, and `needsRedeploy` behavior
- current sessions, source values, messages, leads, analytics summaries, retention, and privacy operations
- current allowed-origin, CORS, token, rate-limit, and session-lock behavior
- current Widget V2 and dashboard deployment environments
- all live custom hostname or reverse-proxy behavior, if any

#### Discarded Phase 1 schema audit

The linked database contains dormant changes from the previous direction. Inventory:

- `agents.kind` and its constraints/triggers
- workspace product-access columns/functions
- `agent_channels`
- `agent_site_assets`
- `agent_site_drafts`
- atomic agent creation/import functions
- automation archive/outbox structures

For each item, record:

- whether current application code reads or writes it
- whether it changes existing Widget behavior through constraints or triggers
- whether it can remain dormant safely
- whether future cleanup is desirable

Do not drop, rewrite, or adopt these structures during WP-0A.

#### Repository focus

- `supabase/migrations/`
- current linked Supabase schema and advisors
- `src/lib/types/`
- `src/lib/widgets/`
- `src/app/api/widgets/`
- `src/app/api/public/widgets/`
- `src/components/widgets/`
- `apps/widget-v2/`
- analytics, privacy, and Flywheel services

#### Exit gate

- schema history is synchronized
- no unknown production-only table/constraint affects the Widget plan
- current widget count, source distribution, and agent cardinality are understood
- no destructive migration is required to start

### WP-0B — Contract Decisions

#### Decisions to freeze

1. exact platform URL shape; recommended default is `/s/[slug]`
2. global slug uniqueness or public-key/slug lookup policy
3. compatibility behavior for the old hosted Widget V2 URL
4. Agent Site lifecycle values
5. draft versus publication boundary
6. exact fields and maximum counts for universal supporting sections
7. site launch/bootstrap token and parent-origin contract
8. whether Widget V2 adds a `site` UI mode that maps to existing `hosted` persistence
9. publication cache and invalidation behavior
10. canonical behavior when a custom domain becomes active
11. chosen hosting/domain provider and its API contract
12. minimum permissions for edit, preview, publish, unpublish, rollback, and domain management
13. site/site-chat fallback when Widget V2, the model, or the database is unavailable
14. compatibility deployment order between the Next.js app and Widget V2

#### Fixed constraints

- no new required agent type
- widget-centered ownership
- existing session source values retained
- no automatic content publication
- no public draft reads
- no full page builder
- no Automation or global-sidebar redesign in this work

#### Exit gate

Every decision has:

- chosen behavior
- rejected alternatives
- security/privacy impact
- rollback behavior
- testable acceptance criteria

### WP-0C — Characterization and Release Baseline

#### Required baseline tests

- hosted bootstrap success/disabled behavior
- embedded exact-origin success/denial
- preview token success/expiry
- Widget V2 hosted desktop and mobile behavior
- loader-based embed behavior
- token refresh
- session turn conflict returns `409 SESSION_BUSY`
- rate-limit responses
- deployed agent-version behavior
- draft preview does not alter live runtime
- session/message/lead persistence
- source is correctly `hosted`, `embedded`, or `preview`
- analytics exclude preview
- Questions capture excludes preview
- existing public keys and embed snippets remain stable

#### Build baseline

- main TypeScript/build verification
- existing security tests
- Widget V2 build
- a minimal hosted and embedded browser smoke test

Existing unrelated lint or dependency findings must be recorded separately rather than silently treated as caused by Agent Site.

#### Phase 0 gate

No Phase 1 implementation begins until WP-0A through WP-0C pass and the two roadmap documents are approved.

## 9. Phase 1 — Shared Delivery Foundation

### Goal

Create the smallest shared contract that lets an existing widget be launched safely as an Agent Site without changing the agent model or breaking embedded delivery.

### WP-1A — Channel and Launch Contract

#### Work

- define server types that present `hosted` as Agent Site and `embedded` as Chat Widget
- add an internal delivery-mode resolver owned by the Widget domain
- define the Agent Site launch URL payload
- define a short-lived, audience-bound site launch/bootstrap token if required by the Phase 0 contract
- bind launch context to widget public key, source, parent/canonical origin, expiry, and preview/public state
- reject arbitrary origin, widget key, source, or parent-domain substitution
- keep stored `widget_sessions.source` values unchanged
- define client-safe error codes for disabled site, unpublished content, invalid launch, invalid domain, and incompatible runtime

#### Likely repository areas

- `src/lib/widgets/server-types.ts`
- `src/lib/widgets/tokens.ts`
- `src/lib/widgets/cors-origin.ts`
- `src/lib/widgets/runtime-config.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/bootstrap/route.ts`
- shared public Widget API validation

#### Out of scope

- new public page
- new site tables
- dashboard redesign
- custom domains

#### Exit gate

- hosted and embedded requests remain distinguishable
- a launch token cannot be replayed for another widget or origin
- embedded origins behave exactly as before
- no new database source value is required

#### Rollback

Keep the old hosted/bootstrap path available. Disable the new site-launch contract without changing widget data.

### WP-1B — Shared Public Runtime Compatibility

#### Work

- add a dedicated Agent Site presentation/mount mode to Widget V2 only if WP-0B requires it
- keep the same `Widget` component, API helpers, session hook, streaming, upload, and completion paths
- preserve hosted and embedded visual modes
- add explicit runtime-version compatibility handling
- make parent-page messaging exact-origin and schema-validated
- define Widget V2 unavailable/loading/error behavior for the future Next.js shell
- retain the current standalone hosted URL during compatibility rollout

#### Likely repository areas

- `apps/widget-v2/src/main.tsx`
- `apps/widget-v2/src/Widget.tsx`
- `apps/widget-v2/src/types.ts`
- `apps/widget-v2/src/lib/api.ts`
- `apps/widget-v2/src/lib/origin.ts`
- `apps/widget-v2/src/lib/postmessage.ts`
- `apps/widget-v2/public/loader.js`
- `apps/widget-v2/README.md`

#### Exit gate

- Widget V2 runs in old hosted mode
- Widget V2 runs through the new site mount contract
- embedded loader behavior remains unchanged
- mobile and desktop smoke tests pass
- old Next.js plus new Widget V2 and new Next.js plus old Widget V2 fail safely during staged deployment

#### Rollback

Redeploy the previous Widget V2 bundle and keep the Next.js feature disabled.

### WP-1C — Internal End-to-End Foundation Gate

#### Work

- add an internal-only test route or harness using an existing test widget
- prove Next.js can create the approved launch context
- prove Widget V2 loads with the correct widget and source
- prove chat persists to existing tables
- prove analytics still sees hosted sessions
- run cross-tenant, guessed-key, expired-token, origin-spoof, and version-mismatch tests

#### Phase 1 gate

- no new agent/site identity is required
- existing Widget V2 hosted and embedded journeys pass
- the new site launch path works internally
- no cross-tenant or cross-widget context is possible
- both deployables have tested rollback

## 10. Phase 2 — SEO-Ready Agent Site

### Goal

Publish a real server-rendered Agent Site at a platform URL, using approved content and the shared Widget V2 runtime.

### WP-2A — Widget-Owned Site Schema

#### Recommended additive schema

Create the Phase 0-approved equivalent of:

#### `widget_site_settings`

- `widget_id`
- workspace integrity key
- site enabled/lifecycle state
- unique platform slug
- draft title and description
- approved contact/business identity fields
- typed section configuration
- index preference
- social image reference
- allowlisted layout variant
- active publication id
- created/updated actor and timestamps

#### `widget_site_publications`

- publication id
- widget/workspace identity
- schema version
- immutable public JSON projection
- relevant attached agent-version manifest
- content hash
- lifecycle
- created/published/retired actor and timestamps

Domain records may be created in Phase 4 unless the chosen hosting provider requires an earlier reservation table.

#### Database requirements

- additive migrations only
- RLS on every exposed table
- explicit grants
- composite widget/workspace integrity
- safe uniqueness for active slugs
- indexes for public resolution and workspace management
- no anonymous direct draft access
- publication rows append-only after activation
- no dependency on `agent_site_drafts` or `agent_channels`

#### Likely repository areas

- new ordered Supabase migrations
- `src/lib/types/widget.ts` or the current Widget type module
- generated/manual database types used by the application

#### Exit gate

- same-workspace authorized CRUD passes
- other-workspace, removed-member, and anonymous draft access fails
- cross-workspace widget references fail at database level
- public resolution returns only active publication data
- migration upgrade and fresh replay pass

#### Rollback

Keep tables dark and disable application callers. Do not drop publication history to roll back behavior.

### WP-2B — Draft and Publication Services

#### Work

- create server-only loaders and validators for site settings
- create authenticated draft update operations
- create preview projection
- create publication validation
- create immutable publication record
- activate publication atomically
- add unpublish and validated rollback
- build a deliberately public field allowlist
- derive content hash and cache identity
- retain previous publication on failure
- audit publish, rollback, suspend, and validation failure

#### Authorization

- view: current workspace member with Widget access
- edit: current member allowed to edit the widget
- publish/rollback/domain: owner/admin initially unless Phase 0 approves another role
- all authorization rechecked server-side immediately before mutation

#### Likely repository areas

- new `src/lib/widgets/site/`
- new authenticated routes under `src/app/api/widgets/[id]/site/`
- existing audit helpers
- Widget loader and workspace authorization helpers

#### Exit gate

- draft changes cannot affect the active public projection
- repeated publish request is idempotent
- invalid or partial publication leaves the previous version live
- rollback restores a valid prior projection
- a deleted/suspended widget cannot be published

### WP-2C — Server-Rendered Platform Route

#### Work

- add the Phase 0-approved public route, recommended `src/app/(public-sites)/s/[slug]/page.tsx`
- resolve only an active widget-owned site publication
- render approved identity, supporting sections, privacy, contact, and chat region
- return correct `404`, unpublished, suspended, and gone behavior
- generate metadata from the publication
- add canonical URL handling
- add robots behavior
- add sitemap generation
- add safe JSON-LD
- add no-JavaScript and chat-failure fallback
- keep visitor-specific API data out of shared page caches

#### Supporting components

Create a small universal component set under a widget-owned public-site namespace, for example:

- site shell
- identity header
- chat mount
- services/capabilities section
- FAQ section
- About section
- proof section
- contact section
- policy/footer links
- unavailable fallback

The exact directory name is frozen during WP-0B. Avoid a broad `agent-sites` domain that implies parallel ownership.

#### Likely repository areas

- `src/app/(public-sites)/`
- `src/components/widgets/site/`
- `src/lib/widgets/site/`
- `src/app/sitemap.ts` or the approved sitemap route
- `src/lib/security-headers.ts`
- `middleware.ts` or `src/lib/supabase/proxy.ts` only where narrowly required
- `next.config.ts`

#### Exit gate

- useful HTML exists before client hydration
- drafts and previews are `noindex`
- metadata and JSON-LD match visible content
- no visitor-specific data enters the HTML or shared cache
- invalid slugs and cross-workspace ids disclose nothing
- JavaScript-off test still exposes approved useful content and contact

#### Rollback

Disable public site delivery and retain the current hosted Widget V2 URL according to the compatibility policy.

### WP-2D — Widget V2 Site Composition

#### Work

- mount/load Widget V2 in the public chat region
- create the site launch context server-side
- bind it to the published widget and exact platform origin
- expose loading, expired, disabled, and retry states
- coordinate theme and approved shared appearance
- propagate only safe page/referrer/attribution values
- preserve Widget V2 session behavior, uploads, completion, leads, and streaming
- provide accessible status announcements outside the isolated chat client where needed

#### Exit gate

- Agent Site conversation creates an existing hosted widget session
- Chat Widget conversation creates an existing embedded session
- sessions do not cross channels or widget ids
- same-session overlap behavior remains correct
- leads and uploads remain scoped
- existing hosted URL and embed snippet still work

### WP-2E — SEO, Accessibility, and Fallback Gate

#### Required checks

- metadata and canonical tests
- robots and sitemap tests
- JSON-LD validation
- keyboard navigation
- screen-reader labels/status
- focus behavior
- reduced motion
- 200% and 400% zoom
- mobile viewport
- slow Widget V2 load
- Widget V2 unavailable
- model/API unavailable
- JavaScript disabled
- long content and both supported application languages
- noindex preview/unpublished/suspended behavior
- basic Core Web Vitals budgets

#### Phase 2 gate

The platform-hosted Agent Site is production-like for an internal/private test widget before Phase 3 management UI is exposed.

## 11. Phase 3 — Website Chat & Agent Site Management UI

### Goal

Evolve the current Widget pages into a clear management experience for both delivery modes without rebuilding the application shell.

### WP-3A — Information Architecture

#### Work

- extend the customer-facing `Website Chat` area with an `Agent Site` delivery section or use the final approved combined label
- keep `/widgets` routes initially to avoid unnecessary redirects
- update list cards to show Agent Site, Chat Widget, publication, and sync state
- define detail navigation with one job per destination
- keep shared appearance, agents, and behavior instead of duplicating forms
- add complete loading, empty, validation, error, permission, and limit states

#### Recommended detail destinations

- Overview
- Agent Site
- Chat Widget
- Content & SEO
- Appearance
- Agents & Behavior
- Domain
- Deployment

The first UI release may combine related destinations, but it must not create empty placeholder tabs.

#### Likely repository areas

- `src/app/(app)/widgets/WidgetsPageClient.tsx`
- `src/app/(app)/widgets/[id]/page.tsx`
- `src/components/widgets/builder/WidgetBuilderHeader.tsx`
- `src/components/widgets/builder/WidgetBuilderContext.tsx`
- localization dictionaries
- app sidebar label only; no global shell redesign

#### Exit gate

Usability review confirms operators understand:

- Agent Site is standalone
- Chat Widget is embedded
- both share agents and appearance
- enabling one does not require disabling the other
- draft, published, and needs-sync states are different

### WP-3B — Agent Site and Content/SEO Management

#### Work

- Agent Site enable/disable control
- platform URL and copy/open action
- server-rendered preview
- title and description fields
- generic typed section editing
- safe ordering and enablement
- social preview
- index preference with clear explanation
- publication validation errors linked to fields
- AI-assisted suggestions only as editable drafts
- verified-fact/FAQ candidates only through explicit selection

#### Constraints

- bounded lengths and section counts
- no arbitrary HTML/JavaScript
- no automatic publish
- no raw transcript insertion
- no niche-specific required fields

#### Likely repository areas

- existing Widget builder context or a carefully separated site sub-context
- new `src/components/widgets/site-management/`
- authenticated widget-site APIs
- localization

#### Exit gate

- an operator can prepare a valid universal Agent Site
- all public text is visible before publish
- cancelled/failed edits do not change the live site
- permissions and validation work without relying on hidden buttons

### WP-3C — Chat Widget and Shared Configuration

#### Work

- preserve embed snippet
- preserve allowed-origin management
- clearly display embedded enablement/status
- preserve shared appearance
- preserve attached agents and behavior
- explain which settings are shared and which are channel-specific
- show existing sessions/history without migration

#### Likely repository areas

- `src/components/widgets/builder/tabs/AppearanceTab.tsx`
- `src/components/widgets/builder/tabs/AgentsTab.tsx`
- `src/components/widgets/builder/tabs/BehaviorTab.tsx`
- `src/components/widgets/builder/tabs/DeploymentTab.tsx`
- current Widget APIs

#### Exit gate

- existing customers can retrieve the same valid snippet
- existing allowed origins remain unchanged
- no widget public key rotates
- appearance changes preview correctly in both modes
- multi-agent chooser and single-auto behavior remain correct

### WP-3D — Preview, Publish, and Deployment UX

#### Work

- one overview of draft changes
- Agent Site preview using draft projection
- embedded Widget preview
- clear distinction between save draft, publish/sync, unpublish, and rollback
- show agent-version drift and site-content drift
- publish validation summary
- channel-specific live status
- deployment compatibility warnings when Widget V2 runtime version is not ready

#### Likely repository areas

- existing Widget preview route
- preview token services
- deploy/status routes
- Widget builder header/context
- new site preview route and components

#### Phase 3 gate

- complete operator journey passes on desktop and mobile
- keyboard and screen-reader behavior passes
- no existing Widget operation is lost
- no global launcher/sidebar work is required

## 12. Phase 4 — Custom Domains

### Goal

Add safe custom-domain ownership, routing, TLS, canonical, removal, and recovery after the platform URL is stable.

### WP-4A — Domain Control-Plane Contract

#### Work

- finalize domain provider adapter
- define normalized hostname rules
- define apex and `www` behavior
- define challenge type and expiry
- define verification retries and rate limits
- define routing/TLS states
- define activation, failure, removal, reassignment, and suspension
- define platform URL fallback
- define provider webhook or polling verification
- define audit and operational alerts

#### Recommended domain states

`pending_verification -> verified -> provisioning -> active`

Failure/terminal alternatives:

- `verification_failed`
- `provisioning_failed`
- `suspended`
- `removing`
- `removed`

#### Exit gate

The provider sandbox/test domain proves the full lifecycle, including removal and reassignment.

### WP-4B — Verification, Routing, and TLS

#### Schema

Add the Phase 0-approved `widget_domains` table with:

- widget/workspace identity
- normalized hostname
- verification challenge and expiry
- verification status
- routing/TLS status
- canonical/redirect preference
- provider ids
- activation/removal history
- actor and audit metadata

#### Routing work

- validate trusted proxy headers for the deployment environment
- reject arbitrary host and forwarded-host values
- resolve only verified active domain rows
- bind hostname to widget and active publication
- generate absolute URLs from the resolved trusted domain record
- partition caches by hostname and publication
- prevent another tenant from claiming active/recently removed ownership without required re-verification
- support deterministic platform fallback

#### Likely repository areas

- new domain migration
- `src/lib/widgets/site/domains/`
- hosting provider adapter
- narrow changes to `middleware.ts` and/or `src/lib/supabase/proxy.ts`
- public site loader
- security headers and canonical generation
- scheduled verification/reconciliation route or worker

#### Exit gate

- host spoofing fails
- unverified/inactive domain fails
- valid domain resolves exactly one widget
- cross-tenant caches cannot mix
- certificate failure is visible and recoverable
- platform URL remains correct
- removal prevents domain takeover and stale serving

#### Rollback

Deactivate the domain mapping and return to the platform URL without changing widget, publication, sessions, or embed delivery.

### WP-4C — Domain UI and Operations

#### Work

- add domain
- display exact DNS instructions
- check verification
- show provisioning/TLS health
- set canonical preference
- remove with impact confirmation
- display platform fallback
- add operator runbook and alerts

#### Phase 4 gate

At least one internal/test domain completes add, verify, activate, renew/health-check, remove, and recover scenarios before limited customer use.

## 13. Phase 5 — Analytics and Governed Improvement

### Goal

Make Agent Site performance visible and let approved real visitor questions improve both delivery modes and optional public FAQ content.

### WP-5A — Channel-Aware Analytics

#### Work

- display `hosted` as Agent Site
- display `embedded` as Chat Widget
- retain raw source values in storage
- filter conversations and leads by channel
- show platform versus custom-domain attribution
- add publication identity to events/sessions only if needed and approved as an additive nullable field
- define conversion events and denominators
- exclude preview and bot/internal traffic according to explicit rules
- keep private transcript/tool content out of analytics properties

#### Likely repository areas

- `src/lib/dashboard/analytics.ts`
- `src/lib/dashboard/summary.ts`
- dashboard conversation summary queries/views
- analytics UI
- public Widget event route and allowlisted properties

#### Exit gate

- the same test widget produces correctly attributed hosted and embedded sessions
- totals reconcile with source data
- preview is excluded
- no existing history is rewritten

### WP-5B — Governed FAQ and Public-Content Promotion

#### Work

- preserve existing unanswered-question capture
- preserve operator answer/edit/dismiss behavior
- allow an approved `public_ready` fact to become a site FAQ candidate
- require explicit operator selection and editing
- detect duplicates/conflicts with existing site FAQ
- require a new site publication
- record source fact and publication provenance
- support removal/retirement through a new publication

#### Likely repository areas

- `src/lib/flywheel/server.ts`
- `/questions`
- verified-fact APIs
- widget-site draft/publication services
- Content & SEO UI

#### Exit gate

- answering a question improves agent knowledge as it does today
- public FAQ remains unchanged until separately selected and published
- private transcript/customer data is not copied
- retirement removes public content from the next publication

### WP-5C — Improvement Validation

#### Work

- measure repeated unanswered-question rate
- sample owner-approved answers for correctness
- compare Agent Site and Chat Widget answer behavior using the same agent version
- verify that public FAQ and structured data match
- test conflicts, expired facts, duplicate candidates, and deleted source records

#### Phase 5 gate

The improvement loop is useful, reviewable, reversible, and cannot automatically publish or change permissions.

## 14. Phase 6 — Hardening and Limited Launch

### Goal

Prove the complete system is secure, private, accessible, reliable, operable, and commercially useful before broader availability.

### WP-6A — Security and Privacy Hardening

#### Required security tests

- same-workspace and cross-workspace authorization
- removed/stale member
- anonymous and guessed ids/slugs/public keys
- direct Data API access
- RLS and grants
- cross-workspace foreign keys
- host/forwarded-host spoofing
- domain reassignment
- launch-token audience, expiry, replay, and widget binding
- embedded exact-origin behavior
- CORS and CSP
- XSS and unsafe URL/content handling
- cache separation
- prompt injection and cross-tenant retrieval
- upload limits and active-content handling
- rate-limit and cost-abuse behavior
- secrets and error redaction

#### Required privacy tests

- AI disclosure
- privacy/contact access without chat
- essential versus non-essential consent
- session/lead export and deletion
- retention
- no transcript or personal data in HTML, metadata, JSON-LD, sitemap, logs, or analytics
- public image/testimonial permission records

#### Exit gate

No unresolved critical/high release issue and no unexplained Supabase security advisor finding for the new schema.

### WP-6B — Performance, Accessibility, and Resilience

#### Performance

- mobile server response and render budgets
- minimal public JavaScript before chat
- lazy/controlled Widget V2 loading without harming first interaction
- image optimization
- cache correctness
- rate and concurrency testing

#### Accessibility

- WCAG 2.2 AA target
- keyboard-only
- screen-reader
- visible focus
- semantic headings
- contrast
- 200%/400% zoom
- reduced motion
- status/stream announcements
- non-streaming fallback

#### Resilience

- Widget V2 deployment outage
- public API outage
- model outage
- database/cache outage within approved behavior
- failed publish
- failed domain verification/TLS
- domain removal
- expired launch token
- plan/message limit
- connection failure
- backup/restore
- previous-publication rollback
- site-only and widget-only suspension

#### Exit gate

All approved service objectives and recovery drills pass in a production-like environment.

### WP-6C — Staged Limited Launch

#### Rollout rings

1. internal synthetic widget on platform URL
2. internal real workflow on platform URL
3. one invited customer on platform URL
4. one invited customer on verified custom domain
5. small invite-only cohort

Each ring requires:

- explicit widget/workspace allowlist
- declared observation period
- support owner
- dashboards and alerts
- rollback rehearsal
- written go/no-go decision

#### Pilot measures

- setup time
- publication success
- conversation and lead outcomes by channel
- owner-approved improvement activity
- repeated-question reduction
- support minutes
- model/hosting/support variable cost
- active retention
- willingness to continue/pay

#### Sentinel failures

Immediately pause the affected rollout scope for:

- cross-tenant data exposure
- private content publication
- domain routing to the wrong tenant
- unsupported public claim caused by automatic publication
- duplicate consequential external action
- loss of existing embed/public-key behavior
- unrecoverable publication/domain failure

#### Phase 6 gate

The product may move to limited availability only when the technical gates pass and the pilot demonstrates useful customer value at an acceptable support and cost level.

## 15. Phase 7 — Earned Expansion

Phase 7 is not a single backlog to implement automatically.

Each expansion requires its own short proposal, evidence, security review, and gate.

Possible earned expansions:

- additional polished layout variants
- richer universal section types
- multilingual site publications
- deeper Search Console/crawl monitoring
- consent-aware campaign attribution
- owner-approved AI drafting assistance
- more advanced action confirmation and receipts
- optional global agent launcher/type-specific shell
- migration or retirement of dormant discarded Phase 1 schema

Still prohibited without a separate roadmap revision:

- general drag-and-drop page builder
- arbitrary custom code
- automatic fact/publication promotion
- unrestricted provider tools
- niche-specific hardcoding presented as universal architecture
- a second parallel chat runtime

## 16. Database Migration Protocol

Every schema change follows:

1. **Reconcile** local and linked migration history.
2. **Inspect** current production constraints, policies, grants, triggers, functions, and indexes.
3. **Expand** with nullable/additive tables or columns.
4. **Secure** with RLS, explicit grants, tenant constraints, and indexes.
5. **Deploy dormant** with no public caller.
6. **Backfill only if required**, in bounded idempotent batches.
7. **Validate** counts, ownership, orphans, and policy behavior.
8. **Shadow/read internally** before serving public traffic.
9. **Cut over one caller/cohort** behind a server-owned control.
10. **Observe** through the declared compatibility window.
11. **Contract later**, in a separate release, only with zero-use evidence.

Rules:

- do not invent migration timestamps
- do not edit already-applied migrations
- do not combine schema expansion, destructive cleanup, public activation, and domain activation
- do not remove dormant Phase 1 schema merely to make the diagram cleaner
- do not bulk rewrite existing widgets, agents, sessions, or public keys
- application rollback must remain compatible with additive schema

## 17. Deployment Protocol

The main application and Widget V2 deploy independently.

For every cross-app contract:

1. add backward-compatible server support
2. deploy and verify the main application
3. deploy compatible Widget V2 support
4. verify old and new paths
5. enable the Agent Site cohort
6. remove old compatibility behavior only in a later release

Never require both deployments to become live at the exact same moment.

The public Agent Site feature control must be server-owned and scoped to explicit widgets/workspaces during rollout.

## 18. Rollback Rules

- **Application rollback:** previous application remains compatible with additive schema.
- **Widget V2 rollback:** redeploy the prior Widget V2 bundle; existing hosted/embed URLs remain valid.
- **Publication rollback:** select a previously valid immutable publication.
- **Public delivery rollback:** disable Agent Site while preserving Chat Widget when safe.
- **Embed rollback:** disable embedded delivery without disabling Agent Site when safe.
- **Domain rollback:** deactivate the domain and return to platform URL.
- **Analytics rollback:** stop new derived reporting without rewriting source sessions/history.
- **Flywheel/public FAQ rollback:** disable candidate promotion and retain the previous publication.
- **Database rollback:** prefer forward-fix; never delete publication, audit, session, or lead history to simulate rollback.

## 19. Required Test Matrix

### 19.1 Roles and tenancy

- owner
- admin
- standard member
- removed member
- other workspace
- anonymous visitor
- scoped public launch token
- raw privileged server client with explicit scope

### 19.2 Delivery modes

- old hosted Widget V2 URL
- new Agent Site platform URL
- embedded loader
- operator preview
- custom domain
- Agent Site only
- Chat Widget only
- both enabled
- each independently disabled

### 19.3 Widget shapes

- zero attached agents where the current product permits a draft
- one attached agent with `single_auto`
- multiple attached agents with chooser
- unpublished agent
- published agent
- agent version changed after widget deployment
- deleted/archived/inaccessible agent

### 19.4 Site lifecycle

- no settings
- draft
- validation failure
- published
- updated draft with old publication still live
- republished
- rolled back
- unpublished
- suspended
- deleted widget

### 19.5 Domain lifecycle

- pending
- invalid DNS
- verified
- provisioning
- active
- certificate failure
- apex/`www`
- canonical switch
- removal
- stale DNS
- reassignment attempt
- host spoof

### 19.6 Failure modes

- slow/offline Widget V2
- expired token
- CORS/origin denial
- model failure
- streaming failure
- message limit
- rate limit
- session busy
- database/publication lookup failure
- cache stale/miss
- publish failure
- domain provider failure
- connection/provider failure

## 20. Repository Change Map

| Concern | Existing areas | Likely additive areas |
| --- | --- | --- |
| Widget domain | `src/lib/widgets/`, current Widget types | `src/lib/widgets/site/` |
| Widget management API | `src/app/api/widgets/` | widget-owned site draft, preview, publish, rollback, and domain routes |
| Public runtime API | `src/app/api/public/widgets/[widgetPublicKey]/` | compatible site launch/bootstrap handling |
| Public page | current Next.js routing/security helpers | `src/app/(public-sites)/s/[slug]/`, `src/components/widgets/site/` |
| Widget V2 | `apps/widget-v2/src/`, `public/loader.js` | compatible Agent Site presentation/mount mode |
| Widget UI | `src/app/(app)/widgets/`, `src/components/widgets/builder/` | site/content/domain management components |
| Database | existing Widget and customer tables | widget-owned site settings, publications, and domains |
| SEO | root metadata/routing helpers | publication-driven metadata, sitemap, robots, JSON-LD |
| Analytics | dashboard analytics and summary services | customer-facing channel labels and optional publication attribution |
| Improve | `src/lib/flywheel/`, `/questions` | explicit FAQ candidate-to-publication workflow |
| Operations | current runbooks/health checks | site/domain/publication deployment and incident runbooks |

Names in the additive column are directional. WP-0B freezes exact paths before implementation.

## 21. Prohibited Implementation Shortcuts

Do not:

1. build or copy a separate Agent Site chat component
2. require a new `agents.kind = website` cutover
3. use `agent_channels` or `agent_site_drafts` as the new foundation
4. create a hidden widget for every site
5. create separate Agent Site sessions/leads
6. migrate existing session source values
7. rotate widget public keys
8. force existing multi-agent widgets into one agent
9. expose mutable draft site rows publicly
10. publish generated text without operator approval
11. use only client-side React/Vite meta tags for SEO
12. render the complete public site as only an iframe
13. trust arbitrary host headers
14. reflect arbitrary origins in CORS
15. cache visitor-specific chat/session data publicly
16. put private conversations into public FAQ or structured data
17. combine custom domains with the first platform-site activation
18. redesign the global sidebar before the Widget area works
19. change Automation or Internal Assistant as incidental scope
20. delete dormant database structures in the same release as Agent Site

## 22. Definition of Ready

A work package is ready only when:

- its dependencies and previous phase gate pass
- the relevant Phase 0 decision remains approved
- exact scope and exclusions are written
- current user worktree changes are inventoried and protected
- migration and deployment order are known
- test cases and rollback owner are named
- no destructive cleanup is hidden inside it

## 23. Definition of Complete

The initial Agent Site implementation is complete only when Phase 0 through Phase 6 pass.

That means:

- the product is built on existing Widget V2
- Agent Site and Chat Widget both work from one Widget configuration
- platform and custom-domain URLs are safe
- approved content is server-rendered and index-controlled
- Builder, Knowledge, Connections, conversations, leads, analytics, and Flywheel remain shared
- old embeds and public keys remain valid
- public drafts/private conversations never leak
- accessibility, performance, privacy, security, reliability, and rollback gates pass
- limited customers demonstrate real value

Code merged, a new tab visible, or a successful local demo does not by itself mean the phase or plan is complete.
