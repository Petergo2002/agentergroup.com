# Agent-Native Websites: Implementation Plan

Last updated: 2026-07-22

Status: Proposed implementation sequence; implementation not started

Parent roadmap: [Agent-Native Websites](./agent-native-websites.md)

## Purpose

This document translates the strategic roadmap into small, dependency-ordered work packages that can be implemented, verified, released, and rolled back independently.

The parent roadmap remains the source of truth for product scope, evidence gates, market assumptions, security/privacy requirements, and the Phase 0-7 go/no-go decisions. This plan controls **implementation order**. Completing a work package never waives its parent phase gate.

The implementation must preserve the current Agents, Automation Agents, Internal Assistants, Widgets, widget public keys, embeds, histories, leads, analytics, Questions/Flywheel records, and privacy operations until an explicit compatibility path has passed its own gate.

## Executive Sequencing Decision

Do not begin with the new sidebar, a visual relabel of `surface = 'widget'`, or a public Agent Site.

The safe critical path is:

> Select wedge/outcome -> validate evidence -> freeze contracts -> verification foundation -> durable agent identity and access -> typed business truth -> provider policy -> immutable publication -> neutral conversation runtime -> governed action ledger -> pilot launcher and shell -> static Agent Site -> read-only concierge -> confirmed selected outcome -> operator controls -> Chat Widget and manual domain -> private-alpha hardening -> staged pilot.

After the Phase 3 pilot gate, the governed Improve loop and self-service productization become separately gated branches. Search/paid growth follows the self-service/commercial gate. A second wedge follows durable first-wedge retention, economics, safety, and operational evidence.

## Why This Order Is Required

The repository audit found several constraints that make a UI-first or all-at-once change unsafe:

- `agents.surface` currently represents `widget`, `automation`, or `assistant`; it does not separate durable agent kind from delivery channel.
- `CreateAgentModal.tsx` currently performs browser-side writes for agent creation. Client visibility checks are not a secure Product access boundary.
- the current workspace controls are separate `automations_enabled` and `internal_assistants_enabled` booleans; they cannot represent discovery, creation, management, runtime, public delivery, suspension, downgrade, and restore independently
- existing `widgets` and `widget_agents` support multi-agent widgets, so existing widgets cannot be silently reclassified as a one-agent Chat Widget channel
- sessions, messages, leads, summaries, analytics, privacy operations, and unanswered questions are currently coupled to widget-owned records
- the current runtime may execute external tools directly; any Agent Site consequential-action path requires a structurally separate propose-confirm-execute-reconcile boundary
- the current connection model is workspace/toolkit scoped and enforces one connection per toolkit, which may not fit multiple future businesses or provider accounts inside one workspace
- current mutable knowledge chunks are insufficient for immutable publication-scoped retrieval
- `npm test` currently runs only `tests/security/*.test.ts`; the intended Agent Site, live database/RLS, browser, and accessibility suites do not exist yet
- many existing security checks are source/contract assertions rather than live HTTP or database authorization tests; they remain valuable regression checks but cannot prove runtime isolation alone
- `supabase/config.toml` references a seed file that is not currently present, and the production-readiness runbook records migration-history drift that must be reconciled before new schema evidence is trusted
- the public widget has its own `apps/widget-v2` build and runtime, so shared-runtime changes must prove both Agent Site and existing Widget compatibility

These are planning facts, not authorization to change the code now.

## Strategic Phases and Work Packages

| Roadmap phase | Ordered work packages | Outcome |
| --- | --- | --- |
| Phase 0 | WP-A, WP-B | Validate the idea and freeze the decisions required for safe implementation |
| Phase 1 | WP-C through WP-I | Build the internal security, truth, publication, runtime, and action foundation |
| Phase 2 | WP-J through WP-N, WP-O1, WP-O2, WP-P | Complete and harden the private end-to-end concierge MVP |
| Phase 3 | WP-Q | Run the staged design-partner pilot and commercial gate |
| Phase 4 | WP-R | Add the governed Improve loop only if pilot evidence supports it |
| Phase 5 | WP-S, WP-T1 through WP-T4 | Productize the proven concierge workflow for safe self-service |
| Phase 6 | WP-U | Add controlled search and paid-growth capabilities |
| Phase 7 | WP-V | Add a separately validated next wedge |

## Dependency Graph

```text
WP-A -> WP-B -> WP-C -> WP-D -> WP-E -> WP-F -> WP-G -> WP-H -> WP-I
     -> PHASE 1 GATE
     -> WP-J -> WP-K -> WP-L -> WP-M -> WP-N
     -> WP-O1 + WP-O2 -> WP-P
     -> PHASE 2 GATE
     -> WP-Q
     -> PHASE 3 GATE

PHASE 3 GATE -> WP-R
PHASE 3 GATE -> WP-S -> WP-T1 -> WP-T2 -> WP-T3 -> WP-T4 -> WP-U

FIRST-WEDGE MATURITY + SEPARATE PHASE 7 ENTRY APPROVAL -> WP-V
```

The graph shows the default critical path. A package may be prototyped or prepared in parallel only when it does not write production data, expose traffic, create a second source of truth, or bypass an unmet dependency. Its release gate remains sequential.

## Delivery Contract for Every Code Work Package

Starting with WP-C, every package must follow the same delivery loop:

1. Confirm the relevant Phase 0 decision records and acceptance criteria.
2. Record current behavior with characterization or contract tests.
3. Add failing tests for the new behavior and negative security cases.
4. Apply additive schema/types before callers; use separate migrations for separable concerns.
5. Implement the server-owned domain service and authorization boundary.
6. Add APIs or server actions, then UI; the UI must consume rather than invent policy.
7. Verify locally and in a production-like environment with retained evidence.
8. Deploy dormant or denied by default.
9. Enable for the smallest explicit workspace/site cohort and observe the declared soak window.
10. Exercise rollback/kill behavior before widening access.
11. Update architecture, runbook, and user-facing documentation only after verified behavior matches reality.

No package is done because the happy path works. It is done only when its exit gate, rollback path, compatibility evidence, and documentation are complete.

### Change-unit rules

- A work package is a release/evidence boundary, not necessarily one pull request.
- Split large packages into reviewable changes in this order where applicable: characterization tests, schema expansion, backfill/validation, server domain service, API, UI, dormant deployment, controlled activation.
- Do not combine unrelated work packages in one pull request merely to reduce the number of releases.
- Schema expansion and legacy contraction must be different releases with an observation window between them.
- A UI pull request may land dormant before its package gate, but it may not expose an incomplete or unauthorized path.
- Update package status and attach evidence in the decision log; do not infer completion from merged branches.

## Phase 0: Validate and Freeze

### WP-A — Discovery Evidence

**Outcome:** Select a credible first wedge/outcome and determine whether its agent-first journey deserves production investment.

**Depends on:** Nothing.

**Deliverables:**

- a documented candidate-wedge scorecard and selected provisional wedge/outcome
- 5-10 selected-wedge operator interviews or observations
- at least 30 moderated visitor tasks across the pre-registered comparison experiences
- provider shortlist and sandbox/controlled-account feasibility evidence
- tested initial package, price hypothesis, support model, and five named design partners plus backups
- recorded task outcomes, assistance, time, preference, safety failures, and operator objections

**Out of scope:** Production schema, routes, migrations, live customer data, or real consequential provider actions.

**Exit gate:** V01-V02 and the parent Phase 0 discovery criteria pass, or the team records a stop, narrow, or redesign decision. Thresholds may not be changed after results are reviewed.

**Rollback:** Not applicable; prototypes and research artifacts only.

### WP-B — Decision and Contract Freeze

**Outcome:** Remove ambiguity that would otherwise force destructive redesign during implementation.

**Depends on:** WP-A.

**Deliverables:**

- approved shared-Builder invariant, agent-kind/channel cardinality, and legacy-widget coexistence decision
- selected-agent route model, launcher/shell prototype, Website Agent page model, Automation compatibility promise, Internal Assistant deferral, and one-job-per-page information architecture
- Product access precedence and lifecycle state machine covering `discover`, `create`, `view`, `edit`, `publish`, `execute`, `deliver_publicly`, `suspend`, `restore`, and downgrade behavior
- industry-neutral business core plus selected-wedge typed truth, provenance, publication, URL/domain, and immutable knowledge-revision contracts
- selected provider contract, capability allowlist, availability semantics, idempotency/status/webhook behavior, and hosted-link fallback
- provider-connection cardinality and ownership decision for multiple future businesses/accounts inside a workspace, including how it coexists with the current one-connection-per-toolkit rule
- durable outbox-consumer platform decision covering scheduler, leases/heartbeat, concurrency, retry/dead-letter policy, deployment owner, monitoring, and recovery
- action, identity, exact-confirmation, reconciliation, unresolved-state, and human-review contracts
- qualified domain-reviewer recommendation, eligibility, safety, escalation, and human-only rules plus evaluation set
- privacy data map, retention/export/deletion rules, consent boundary, threat model, abuse budgets, SLOs, event dictionary, pilot metrics, and kill criteria
- explicit mapping for every item under “Must be decided in Phase 0” in the parent roadmap, including owner, evidence, consequence, and reversal trigger

**Out of scope:** Production implementation.

**Exit gate:** Every Phase 0 decision has written approval from its accountable owner; unresolved provider semantics narrow the selected outcome instead of being assumed away.

**Rollback:** Revise the decision records before WP-C. Once implementation begins, a changed contract requires impact analysis and a revised plan rather than an informal deviation.

### Phase 0 Release Gate

WP-C may begin only after WP-A and WP-B are complete **and** the complete parent Phase 0 gate passes. That aggregate gate includes the pre-registered validation result, provider feasibility, launcher/visitor comprehension, security/privacy review, credible price/cost hypothesis, and committed design partners. A completed architecture decision list without the required market, provider, safety, and partner evidence is not permission to begin production changes.

## Phase 1: Secure Internal Foundation

No anonymous public traffic or real customer consequential action is permitted during this phase. Every new capability defaults off/denied.

### WP-C — Verification and Release Foundation

**Outcome:** Create the evidence system needed to make later architectural changes safely.

**Depends on:** The complete Phase 0 release gate.

**Deliverables:**

- reconcile linked Supabase migration history before generating a new migration
- make local database startup deterministic by adding the approved seed or disabling the missing-seed reference intentionally
- add explicit scripts for type checking, Agent Site unit/contract tests, live database/RLS tests, browser E2E, and accessibility
- define the execution ladder: fast lint/type/unit/contract/secret/dependency checks on pull requests; isolated local-Supabase migration/RLS tests and browser journeys in CI; provider-fault, upgrade, performance, restore, and manual evidence in staging/release review
- wire those suites into CI with named environments, non-production credentials, deterministic fixtures, retained failure artifacts, frequencies, and required checks; pull-request CI must never call a real provider or mutate linked production Supabase
- add two-workspace, multi-role fixtures and a fault-injecting fake provider
- prove the selected durable outbox consumer can schedule, lease, heartbeat, retry, dead-letter, resume, and expose health without relying on request-lifetime `after()` work
- capture golden regression journeys for the current agent library/builder, Widget embed/hosted/preview, automation entitlement/execution, auth, billing, privacy, analytics, leads, and Questions/Flywheel behavior
- define dormant rollout controls, deny-only kill switches, evidence ownership, and release checklist templates

**Repository focus:** `package.json`, `.github/workflows/ci.yml`, `supabase/config.toml`, `tests/security/`, new `tests/agent-sites/`, database integration tests, browser tests, and test fixtures.

**Out of scope:** User-visible product behavior or new production data models.

**Exit gate:** A database can be replayed from zero and upgraded from the representative prior release; existing suites and golden journeys pass; the new suites demonstrably execute in their declared environments; dependency/secret checks and evidence retention are active; the worker test harness survives lease expiry and restart.

**Rollback:** Keep new checks non-destructive. A flaky or unavailable environment may block the package, but the check may not be silently removed or marked passing.

### WP-D — Agent Identity, Product Access, and Lifecycle

**Outcome:** Establish the durable Website Agent model before any new navigation or public channel is built around it.

**Depends on:** WP-C.

**Deliverables:**

- inventory current agents, surfaces, widgets, zero/one/multi-agent widget mappings, public keys, active histories, and embed origins
- inventory every type-dependent contract before schema work, including agent-library template surface, surface checks, insert/update RLS, private agent-edit/identity guards, imports, builder bootstrap, automation execution, webhooks, plan-limit triggers, and dashboard/report filters
- preserve the existing Agent Builder and supported Connections as shared core capabilities; Website Agent pages wrap them, Automation retains its existing behavior, and Internal Assistant remains compatible but deferred/hidden unless explicitly enabled
- add the Phase 0-approved canonical immutable agent-kind representation while retaining `agents.surface` as a compatibility field
- freeze and enforce the channel taxonomy, cardinality, access, and lifecycle contracts without yet creating Website Agent channel records or converting legacy widgets
- add normalized workspace Product access for distinct `discover`, `create`, `view`, `edit`, `publish`, `execute`, `deliver_publicly`, `suspend`, and `restore` operations
- define one authoritative source and fail-closed precedence for every migration stage between the new Product access records, current workspace booleans, subscription/integration entitlements, plan limits, roles, lifecycle, and kill switches; mismatches create an owned alert
- implement one server-owned effective-access resolver with stable allow/deny reasons
- enforce access in server actions/routes, workers, webhooks, database policy/constraints where appropriate, and audited suspend/restore operations
- replace browser-owned multi-row agent creation with one validated, authorized, idempotent database transaction/RPC for agent, draft, Product access, and plan-limit checks before Website Agent creation is enabled; moving two independent inserts into a Route Handler is not atomic
- make compatibility writes to legacy booleans and new Product access state one transactional/idempotent mutation with drift reconciliation, never sequential best-effort application writes
- add immutable-kind and cross-workspace database backstops
- backfill only deterministic kinds; leave ambiguous legacy widget agents on an explicit compatibility path

**Repository focus:** `src/lib/types/enums.ts`, `src/lib/types/agent.ts`, `src/lib/types/workspace.ts`, `src/lib/agents/`, `src/lib/assistants/feature-flags.ts`, `src/lib/app/bootstrap.ts`, `src/lib/plan-limits.ts`, `src/lib/widget-limits.ts`, `src/lib/automation/executor.ts`, `src/app/actions/agents.ts`, `src/components/modals/CreateAgentModal.tsx`, agent/library/import/clone/runtime/admin/webhook paths, dashboard filtering, `workspace_subscriptions.integrations_enabled`, relevant surface checks/RLS/private helpers/plan-limit triggers, and additive Supabase migrations.

**Out of scope:** Launcher redesign, public Website Agent creation, or legacy-widget conversion.

**Exit gate:** The WP-D identity/access portion of V05 passes. Guessed ids, type-mismatched routes, direct Data API writes, disabled-kind creation, import/clone bypasses, stale membership, current create/view/edit/suspend/restore races, and contract-level deny tests for every future operation fail safely. Disagreement between legacy/new access state cannot broaden access. Restore preserves data but never automatically resumes runtime, delivery, a provider connection, or publication. Existing agents and widgets retain their behavior and identifiers. Each later caller must add its own race test when it becomes real.

**Rollback:** Keep old readers compatible, keep new behavior behind explicit workspace controls, and reverse the resolver/cutover flag. Do not destructively down-migrate identity or audit data.

### WP-E — Typed Business Truth and Agent Site Identity

**Outcome:** Create the tenant-safe industry-neutral business core and Phase 0-selected wedge data layer in a dark, internal-only state.

**Depends on:** WP-D.

**Deliverables:**

- typed business identity/publication core plus only the selected wedge's approved offers, people/resources, policies, proof/reviews, provenance, rights, and freshness state
- Website Agent to business/site relationships with workspace-integrity constraints
- concrete Website Agent channel records, Agent Site base record, section configuration, and domain reservation/verification state
- server-only validation and authorization services plus authenticated draft APIs
- RLS, explicit grants, indexes, composite tenant constraints, lifecycle behavior, and audit events

**Repository focus:** additive Supabase migrations; new `src/lib/agent-sites/`; new authenticated `src/app/api/agent-sites/`; shared types and validation.

**Out of scope:** Public rendering, automatic imports, publication activation, provider mutations, or customer traffic.

**Exit gate:** Typed validation, owner/admin/member/removed/other-workspace role tests, direct Data API tests, cross-workspace constraint tests, deletion/lifecycle behavior, and database advisor review pass.

**Rollback:** Disable the internal APIs and retain the additive dark tables. Do not drop data to roll back application behavior.

### WP-F — Provider Binding and Versioned Action Policy

**Outcome:** Make provider and action authority deterministic before any live provider-backed consequential action is exposed.

**Depends on:** WP-E and the Phase 0 provider decision.

**Deliverables:**

- explicit business/site provider bindings and connected-account ownership checks
- additive connection-cardinality compatibility for the current workspace/toolkit connection model and the approved future business/provider-account model; no implicit “first connection” resolution
- provider adapter contract with capability discovery, precondition/status, execute, webhook, evidence, and reconciliation semantics for the selected outcome
- allowlisted accounts, resources/records, destinations, and permitted operations required by the selected outcome
- immutable/versioned action policies covering identity, proposal, confirmation, limits, provider capability, and human-review rules
- permission capabilities and deny-only runtime envelope that the model cannot broaden

**Out of scope:** Production provider mutation or real visitor consequential action.

**Repository focus:** connection and agent-connection schema; `src/lib/connections.ts`; `src/lib/composio.ts`; `src/lib/cal.ts`; `src/lib/google-calendar.ts`; connection APIs; builder connection resolution; provider webhooks; and new provider-binding/action-policy services.

**Exit gate:** Browser/model input cannot select arbitrary accounts, resources, records, destinations, policy versions, or actions. Revoked/stale bindings fail closed, and the fake/sandbox adapter satisfies the selected-outcome contract.

**Rollback:** No live runtime is enabled. Retire test policies while retaining their history and audit references.

### WP-G — Immutable Publication, Retrieval, and Artifacts

**Outcome:** Prove that draft truth and live truth cannot mix.

**Depends on:** WP-E and WP-F.

**Deliverables:**

- append-only source/chunk or equivalent knowledge revisions
- immutable publications, source/policy manifests, content hashes, projected sections/search content, artifacts, and publication events
- publication validation and atomic activation
- nullable active-publication reference added only after publication records exist, avoiding circular migration dependencies
- publication-scoped retrieval plus the immutable runtime-context contract that WP-H will bind to sessions
- content-addressed last-known-good artifact plus conditional rollback that rechecks current rights, deletion, safety, provider, and policy conditions
- cache keys that include tenant, site, channel, publication, locale, and relevant runtime version

**Out of scope:** Anonymous routes or chat.

**Exit gate:** V04 and the publication/retrieval portion of V03 pass. Draft edits do not alter active content or immutable retrieval inputs; Product access changes racing publication fail closed; an injected publication/cache failure leaves the prior version active; unsafe rollback is blocked; backup/restore preserves publications, pointers, domains, tombstones, and audit history. The complete pinned-session V03 scenario is required after WP-H and again at the aggregate Phase 1 gate.

**Rollback:** Revalidate and move the active pointer to a known-safe publication. Never mutate or delete publication history as an application rollback.

### WP-H — Neutral Customer Persistence and Proposal-Only Runtime

**Outcome:** Create a surface-neutral runtime without turning Agent Sites into hidden widgets.

**Depends on:** WP-D and WP-G.

**Deliverables:**

- surface-neutral sessions, messages, contacts/leads, summaries, channel attribution, retention state, and publication/policy/runtime pinning
- capped session bootstrap and scoped public-token contract
- versioned notice/consent state, timestamps, withdrawal, permitted measurement state, and a no-consent service path associated with the correct visitor/session/channel scope
- minimum retention, lookup, export, correction, deletion, and legal/incident-hold services for neutral customer data before any real identity is collected; existing legacy privacy behavior must retain parity
- transport-neutral orchestration extracted from the current widget path rather than copied
- publication-scoped retrieval, redacted events, and structurally proposal-only behavior for consequential requests
- surface-neutral rate limiting, trusted-client-IP handling, message/usage accounting, lead/contact validation, billing attribution, and abuse budgets rather than reuse of widget-specific identifiers
- compatibility repositories that let analytics, Customers, Improve, privacy, and admin reporting read the legacy and neutral stores intentionally
- widget regression adapters/tests; existing widgets remain on their proven store until an opt-in migration is justified

**Repository focus:** new `src/lib/agent-sites/runtime/`; `src/lib/runtime/agent-chat.ts`; current widget chat routes; `src/lib/rate-limit.ts`; `src/lib/message-usage.ts`; `src/lib/trusted-client-ip.ts`; public validation/lead helpers; `src/lib/dashboard/analytics.ts`; `src/lib/flywheel/server.ts`; `src/lib/privacy.ts`; `src/lib/leads/conversation-summary.ts`; `src/lib/admin/queries.ts`; additive neutral persistence migrations.

**Out of scope:** Consequential provider execution, destructive session migration, or blind dual writes.

**Exit gate:** Agent Site fixtures operate without `widget_id`; every session is pinned and isolated; the complete V03 session-pin scenario passes; Product access changes racing session bootstrap/conversation fail closed; consent/withdrawal, quotas, usage, contacts, and privacy operations stay scoped; a neutral-data export/delete/retention test passes before real identities; proposal-only paths cannot fall through to direct tools; existing Widget build, runtime, security, histories, analytics, and privacy regression tests remain green.

**Rollback:** Enable only for explicit test workspaces. Route Agent Site traffic off and leave existing Widget storage/runtime untouched. Avoid dual provider execution and unverified dual writes.

### WP-I — Governed Action Ledger, Outbox, and Reconciliation

**Outcome:** Make the Phase 0-selected consequential action durable and truthful before its customer UI exists.

**Depends on:** WP-F and WP-H.

**Deliverables:**

- immutable proposals and material-change rules
- exact visitor-confirmation binding
- the canonical action state machine: `proposed -> awaiting_confirmation -> confirmed -> queued -> executing`; `executing -> succeeded | failed | unknown`; `unknown -> reconciling -> succeeded | failed | manual_review_required`; `manual_review_required -> succeeded | failed | unresolved`; plus `expired`, `cancelled_before_execution`, and `rejected_by_policy` before provider commitment
- stable idempotency identity, execution attempts, atomic outbox insertion, worker claims, receipts, audits, and redacted events
- the WP-B/WP-C-approved durable consumer with bounded leases, heartbeat, retry/dead-letter behavior, deployment ownership, health signals, and mixed-version job compatibility
- fake/sandbox provider execution first, followed by verified status and webhook reconciliation
- canonical states remain durable and auditable; simpler visitor/operator labels are projections and never replace ledger state
- legal/safety and incident deny-only controls plus action kill switches at global, provider, workspace, and site scope and operational reconciliation queues

**Out of scope:** Real visitor provider mutations or model-controlled authorization.

**Exit gate:** V06 passes. Product access changes racing confirmation/queue/execution fail closed without losing reconciliation; crash and concurrency tests at every provider boundary, duplicate clicks/retries/webhooks, out-of-order events, selected-outcome conflict races, revoked connections, worker restarts, lease expiry, dead-letter recovery, and mixed old/new worker-job versions converge on one local action identity without false success or unsafe retry.

**Rollback:** Disable new execution while continuing to reconcile queued/in-flight work. Never discard or blindly retry an ambiguous external effect.

### Phase 1 Release Gate

WP-C through WP-I must all pass the parent Phase 1 gate before any anonymous public traffic. This includes the complete V05 resolver/contract and all then-existing internal publication, conversation, and execution callers; real public-delivery race coverage repeats when WP-K/WP-O1 add those callers. Passing an individual package is not permission to expose it.

## Phase 2: Private End-to-End Concierge MVP

### WP-J — Pilot Launcher, Website Agent Shell, and Authoring

**Outcome:** Introduce the pilot shell and stable navigation contract for staff and invited pilot operators without prematurely shipping general self-service.

**Depends on:** The complete Phase 1 gate.

**Deliverables:**

- `/agents` as a calm launcher for authorized existing agents with clear empty/loading/error states
- per-workspace authenticated-root cutover into the launcher for enabled pilot workspaces; non-enabled workspaces retain their current onboarding/default-root and legacy shell behavior
- safe direct links, agent switching, selected-agent context, and an authoritative type guard in the selected-agent layout
- Website Agent shell with only working destinations from `Overview`, `Builder`, `My Site`, `Widget`, `Customers`, `Improve`, `Connections`, and `Settings`
- the existing Builder and supported Connections remain the same shared core pages; the shell adds Website Agent-specific `My Site` and `Widget` operations around them rather than creating a second builder
- compatibility presentation for existing Widget and Automation agents without changing their durable type or redesigning their workflows; Internal Assistant remains hidden unless enabled and receives no new product work
- unsaved-change protection and complete request/cache/form state clearing when switching agents

**Repository focus:** `src/app/(app)/agents/page.tsx`, `src/app/(app)/agents/AgentsPageClient.tsx`, `src/app/(app)/agents/[id]/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/onboarding/`, `src/lib/auth-redirect.ts`, login/callback actions, dashboard/default-root behavior, `src/components/ui/ModalProvider.tsx`, `src/components/layout/AppShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/app/AppContext.tsx`, `src/components/agents/AgentViewTabs.tsx`, new launcher/shell/sidebar components, `src/lib/agents/builder-bootstrap.ts`, and localization.

**Out of scope:** Open self-service type creation, billing, automated entitlement administration, forced legacy migration, or nonfunctional placeholder navigation.

**Exit gate:** Direct-link, stale-role, cross-tenant, kind mismatch, agent switching, unsaved state, keyboard, screen-reader, responsive, and empty/error state tests pass. Builder/connection regression tests prove existing Agent and Automation work remains functional. `My Site` and `Widget` appear only for Website Agents; Internal Assistant remains deferred. Hiding a destination never substitutes for server authorization.

**Rollback:** Enable per workspace behind the server-owned shell control. Preserve the current global shell and routes until pilot acceptance.

### WP-K — Static Agent Site Channel

**Outcome:** Deliver a useful, trustworthy website before chat or actions.

**Depends on:** WP-G and WP-J.

**Deliverables:**

- platform URL and allowlisted public loader
- server-rendered selected-wedge offers, price guidance where relevant, people/proof, policies, operating/service details, and human contact from the active publication only
- accessible components, correct publication-derived document language/direction at the root document boundary, canonical metadata, robots, sitemap, structured data, and legal/privacy/contact pages
- scoped public token/bootstrap boundary, explicit `/s` routing, host validation groundwork, cache isolation, and last-known-good delivery

**Repository focus:** new `src/app/(public-sites)/s/[slug]/`; new `src/components/agent-sites/`; new scoped public APIs; `src/app/layout.tsx`; `src/lib/i18n-server.ts`; `src/lib/security-headers.ts`; `middleware.ts`; `src/lib/supabase/proxy.ts`; `next.config.ts`; and the WP-B-approved hosting/domain control plane.

**Out of scope:** Chat, provider writes, automated domains, or drafts in public rendering.

**Exit gate:** V07 plus applicable V14 and V16 scenarios pass. Product access and lifecycle changes racing public bootstrap/delivery fail closed according to the fallback policy. The site exposes no draft/private/cross-tenant data and remains useful without JavaScript, the model, selected operational provider, analytics, or live database within the approved staleness bound.

**Rollback:** Disable public delivery for the affected site while retaining the approved static/human-contact fallback according to the deny-only policy.

### WP-L — Grounded Read-Only Concierge

**Outcome:** Prove safe selected-wedge discovery, recommendation, and escalation guidance before enabling provider mutations.

**Depends on:** WP-H and WP-K.

**Deliverables:**

- scoped bootstrap/chat routes with streaming and non-streaming fallback
- publication-pinned retrieval, suggested intents, grounded recommendations, uncertainty behavior, domain-approved must-escalate boundaries, and human handoff
- read-only relevant provider status/data with freshness and source labels
- versioned notice/consent UX with reject/withdraw behavior and a fully functional no-consent service path; non-essential measurement remains off unless permitted
- private knowledge-gap capture, limits, abuse controls, cost budgets, redaction, and observable fallback events

**Out of scope:** Provider mutation or claims of a completed selected outcome.

**Exit gate:** V08, V13, V14, and V16 pass with the qualified domain-evaluation thresholds, including must-escalate recall, conflicting/missing/expired facts, prompt injection, model/stream failure, slow network, and safe human fallback. Existing Widget golden tests stay green.

**Rollback:** Disable conversation for the site; static content and human contact remain available.

### WP-M — Confirmed Selected-Outcome End-to-End Slice

**Outcome:** Complete the first provider-backed customer outcome without false success or duplicate effects.

**Depends on:** WP-I and WP-L.

**Deliverables:**

- persisted contact-verification challenge, provider, hashed/limited secret handling, attempts, expiry, audience binding, replay prevention, rate limits, and verified result at the approved point
- relevant live-precondition recheck and immutable proposal UI showing every material action argument, expectation/commitment, price where relevant, and policy
- exact explicit confirmation and material-change re-confirmation
- separate policy/execution service, provider-backed status/receipt, reconciliation, connection health, abuse limits, and legal/safety plus global/provider/workspace/site action kill switches
- truthful visitor labels backed by canonical `queued`, `executing`, `unknown`, `reconciling`, `manual_review_required`, `succeeded`, `failed`, and `unresolved` ledger states, plus provider-hosted/human fallback

**Out of scope:** Any consequential action beyond the one selected in Phase 0, marketing, returning-visitor memory, broad multi-location/complex workflows, or unrestricted tools.

**Exit gate:** V09-V12 and V15 pass. Verification replay/expiry/attempt limits work; refreshes, double-clicks, retries, races, timeouts, webhook replay, and worker restarts cannot duplicate the external effect; every success has the approved system-of-record evidence; ambiguous outcomes remain truthful and owned. WP-M uses synthetic/internal identities only until WP-N's operator/privacy gate and WP-P's private-alpha gate pass.

**Rollback:** Turn actions off at site/workspace/provider/global scope, stop new execution, reconcile every in-flight action, and fall back to the provider-hosted flow or human handoff.

### WP-N — Operator Outcomes, Privacy, and Incident Controls

**Outcome:** Give pilot operators and Agentergroup staff the minimum controls needed to operate real outcomes safely.

**Depends on:** WP-M.

**Deliverables:**

- minimal `Overview` view for connection, publication, action, unresolved, and incident attention
- minimal `Customers` view for permitted contacts, conversations, proposals, outcomes, receipts, channel attribution, and handoff state
- action-review and reconciliation ownership without exposing internal credentials or raw sensitive logs
- privacy lookup/export/correction/deletion, retention enforcement, and legal-hold/incident exceptions across neutral and legacy stores
- redacted operational dashboards, alerts, budgets, and named escalation paths

**Repository focus:** existing dashboard, analytics, leads, privacy, admin, and Questions services/components through compatibility repositories; new Website Agent-scoped operator routes.

**Out of scope:** Governed Improve publishing, automated follow-up, CRM replacement, or generalized analytics redesign.

**Exit gate:** Same/cross-tenant role tests, DSAR/retention drills, redaction tests, unresolved-action ownership, and channel-attribution tests pass. Operators can distinguish proposed, awaiting confirmation, queued/in progress, succeeded, failed, unknown/reconciling, manual review required, and unresolved outcomes while support staff can see the underlying canonical ledger state.

**Rollback:** Hide the new scoped views through the server control while retaining audit/reconciliation/privacy jobs. Never disable legal or in-flight action obligations merely because the UI rolls back.

### WP-O1 — Website Agent Chat Widget Channel

**Outcome:** Prove that one Website Agent can safely serve an Agent Site and optional embedded Chat Widget without duplicating intelligence.

**Depends on:** WP-L, WP-M, and WP-N.

**Deliverables:**

- new Chat Widget channel backed by the Website Agent's approved publication, runtime, and policy
- channel-specific appearance, origin allowlist, delivery state, sessions, consent context, and attribution
- preservation of existing multi-agent Widgets as an explicit legacy subsystem
- independent Agent Site, Chat Widget, and action suspension controls

**Repository focus:** current Widget management and public APIs, `src/app/(app)/widgets/WidgetsPageClient.tsx`, `apps/widget-v2`, and new Website Agent channel services.

**Out of scope:** Forced legacy conversion, custom-domain work, or removing current Widget keys/history.

**Exit gate:** Cross-channel contract, browser, exact-origin, consent, usage, suspension, and isolation tests pass. Shared truth/runtime is demonstrated without duplicated agent configuration; channels suspend independently; no history, attribution, tenant, or consent state crosses boundaries.

**Rollback:** Disable the new Chat Widget channel independently and leave Agent Sites and legacy Widgets untouched.

### WP-O2 — Manual Pilot Custom Domain

**Outcome:** Prove one manually operated custom domain without coupling DNS/TLS/host-routing risk to the new Chat Widget release.

**Depends on:** WP-K, WP-M, and WP-N. It does not depend on WP-O1, although the default plan completes WP-O1 first to keep only one new release risk active at a time.

**Deliverables:**

- one manually operated verified custom-domain path with trusted host normalization and host-first routing
- canonical ownership, apex/`www` behavior, certificate and verification state, cache invalidation, removal, and reassignment protection
- independent domain delivery control and deterministic platform-URL fallback
- hosting/control-plane runbook with named operator, proof of ownership, rollback, and incident steps

**Repository focus:** `middleware.ts`, `src/lib/supabase/proxy.ts`, `src/lib/security-headers.ts`, `src/app/layout.tsx`, `next.config.ts`, Agent Site domain records/services, and the approved hosting/domain control plane.

**Out of scope:** Automated self-service domain lifecycle or Chat Widget channel changes.

**Exit gate:** V17 passes. Host and forwarded-host spoofing, inactive/unverified/ambiguous mappings, cross-tenant cache/routing, certificate failure, removal, reassignment, canonical/noindex behavior, and rollback are verified independently of WP-O1.

**Rollback:** Remove the custom-domain mapping safely, invalidate affected caches, and return to the platform URL without altering Chat Widget or selected-outcome state.

### WP-P — Private-Alpha Hardening

**Outcome:** Produce complete release evidence instead of adding more features.

**Depends on:** WP-J through WP-N plus both WP-O1 and WP-O2.

**Deliverables:**

- complete security, RLS/grant, privacy, accessibility, performance, abuse/cost, provider-fault, backup/restore, domain, and outage evidence
- kill-switch, stale-content, reconciliation, DSAR, incident, and recovery drills
- production-like evaluation and design-partner acceptance
- release/rollback runbooks, dashboards, alert ownership, and traffic budgets

**Out of scope:** New feature scope.

**Exit gate:** The complete parent Phase 2 gate and V03-V17 pass in a production-like environment. Any duplicate external effect, false success, cross-tenant/private leak, must-escalate miss, or unsafe host mapping blocks launch.

**Rollback:** Do not start the live pilot until this package passes. If a finding occurs during hardening, keep the affected capability off while correcting it.

## Phase 3: Staged Design-Partner Pilot

### WP-Q — Pilot Rollout Rings and Commercial Gate

**Outcome:** Prove value, operator trust, reliability, supportability, and credible economics with real design partners.

**Depends on:** The complete Phase 2 gate.

**Rollout rings:**

1. internal production smoke test with synthetic data
2. one selected-wedge business on the platform URL with invited traffic
3. one selected-wedge business on a verified custom domain
4. up to five approved selected-wedge businesses under traffic caps

Each ring requires a predeclared soak window, evidence review, and written go/no-go decision. Rollout assignment is by explicit workspace/site allowlist, never random per request or model turn. A visitor session remains pinned to compatible publication, policy, provider, and runtime versions.

**Deliverables:** Paid or contractually meaningful pilot, daily early-stage review, operator training, support/cost tracking, outcome reconciliation, safety sampling, failure drills, and prospective metric reporting.

**Out of scope:** Open signup, paid acquisition, a new wedge, or large features invented during the pilot.

**Exit gate:** V18 and the parent Phase 3 commercial/safety gate pass. Failures produce stop, narrow, or redesign—not automatic expansion.

**Rollback:** Pause cohort expansion immediately on sentinel failure. Disable actions or public delivery only at the necessary scope, continue reconciliation, and preserve safe static information and human contact where permitted.

## Phase 4: Governed Improve Loop

### WP-R — Evidence-to-Approved-Truth Workflow

**Outcome:** Let real demand improve future answers and, separately, public information without making raw conversations or model output authoritative.

**Depends on:** The Phase 3 gate plus WP-G and WP-H. It does not depend on self-service.

**Promotion rings:**

1. private observation and candidate collection
2. operator review/edit with provenance and conflict checks
3. approved fact eligible for new-session agent retrieval
4. separately approved public-ready fact included through a new publication

**Repository focus:** `src/lib/flywheel/server.ts`, `/questions`, neutral conversation references, publication projection, evaluation reports, and the Website Agent `Improve` destination.

**Out of scope:** Automatic prompt, policy, action, or public-truth changes.

**Exit gate:** V19 passes. Correction/retirement removes the claim deterministically; raw transcript context, personal data, internal notes, and unapproved output never become public.

**Rollback:** Disable candidate use or public-ready publishing and retain the prior safe publication. Preserve private evidence according to approved retention rules.

## Phase 5: Self-Service First-Wedge SaaS

Phase 4 and Phase 5 may be prioritized independently after Phase 3 based on the measured bottleneck. Neither gate waives the other.

### WP-S — Self-Service Launcher and Guided Setup

**Outcome:** Turn the proven concierge setup into a customer-operated flow without exposing platform internals.

**Depends on:** The Phase 3 gate and WP-J. Phase 4 is optional.

**Deliverables:**

- full Agent launcher with `Create agent`, existing-agent cards, switching, limits, and safe direct links
- intent-led choice: Website Agent is the primary product focus; Automation Agent remains available when entitled; Internal Assistant stays hidden unless explicitly enabled and receives no new scope
- guided creation consumes the single server-owned atomic creation service and effective-access resolver established in WP-D; it must not introduce a second creation or entitlement path
- final type-specific shells preserve the shared Builder and Connections; Website Agent uses `Overview`, `Builder`, `My Site`, `Widget`, `Customers`, `Improve`, `Connections`, and `Settings`; Automation retains relevant builder/run pages; Internal Assistant remains compatibility-only
- selected-wedge onboarding around the shared Builder, reviewed import, safe defaults, scenario preview, launch-readiness scoring, and blocking completeness checks

**Out of scope:** Paid growth, arbitrary themes/code, generalized multi-wedge behavior, or a broad agent marketplace.

**Exit gate:** Representative selected-wedge operators choose the permitted type, use the preserved Builder and supported Connections, understand that `My Site` and `Widget` belong only to Website Agents, complete safe setup, and are blocked from unsafe launch without needing internal surface or deployment terminology. Automation regression tests remain green and Internal Assistant remains deferred. Import tests cover SSRF and DNS rebinding, redirects, private/reserved networks, size/time/content-type limits, malicious instructions, provenance/rights, draft-only status, conflicts, and required operator review.

**Rollback:** Enable by explicit workspace/plan cohort. Disable new self-service creation while preserving all existing agents and concierge operation.

### WP-T1 — Roles, Product Access, and Lifecycle UX

**Outcome:** Let authorized owners/admins understand and operate access/lifecycle state without exposing database policy concepts.

**Depends on:** WP-S.

**Deliverables:**

- workspace roles/capabilities and audited Agentergroup-admin Product access controls
- explicit plan downgrade, read-only, runtime suspension, public-delivery suspension, restore, and re-enable UX

**Out of scope:** Billing enforcement, automated domains, paid growth, or another wedge.

**Exit gate:** Role and operation-specific `discover/create/view/edit/publish/execute/deliver_publicly/suspend/restore` behavior matches the central resolver and audit log. Disable/restore preserves data and never silently resumes runtime, delivery, provider connection, or publication.

**Rollback:** Disable the self-service controls while retaining staff-operated lifecycle services and current explicit state.

### WP-T2 — Channel, Domain, and Provider Operations

**Outcome:** Make the proven channels and provider connection safely operable without staff-only infrastructure steps.

**Depends on:** WP-T1, WP-O1, and WP-O2.

**Deliverables:**

- channel manager for Agent Site and optional Chat Widget from shared approved truth/policy
- automated domain verification, certificate, routing, removal, and reassignment lifecycle
- provider health/reauthorization, channel health, publication history/rollback, privacy tools, incident notices, and support paths

**Out of scope:** Billing enforcement, paid growth, or another wedge.

**Exit gate:** Channel and provider failures, domain takeover/reassignment, certificate failure, rollback, privacy requests, and incident notices pass independent tests and controls. Automated domain/provider recovery never silently republishes or executes.

**Rollback:** Disable domain automation, provider self-service, or either channel control independently while retaining the platform URL, existing publications, and staff-operated recovery.

### WP-T3 — Billing, Limits, and Downgrade Safety

**Outcome:** Enforce the tested commercial package without deleting data or producing unsafe runtime surprises.

**Depends on:** WP-T1 and WP-T2.

**Deliverables:**

- billing and limits for agents, sites/channels, usage, verified contacts, actions, storage, and support
- transactional plan-limit enforcement in create/import/duplicate/publish/execute paths
- explicit trial, grace, read-only, downgrade, failed-payment, credit, and recovery behavior
- usage/cost reconciliation and customer-visible limit reasons

**Out of scope:** Paid acquisition or a second wedge.

**Exit gate:** Concurrent limit checks cannot over-create or over-execute; downgrade/billing failures preserve data and approved fallback content; recovery never silently resumes or republishes; invoices, usage, credits, and audit events reconcile.

**Rollback:** Stop new billing enforcement only through an approved operational override that preserves auditability; keep accounts in an explicit safe state and never delete data to resolve a plan mismatch.

### WP-T4 — Limited Availability and Phase 5 Gate

**Outcome:** Prove that the self-service product is supportable, retained, and commercially credible before growth.

**Depends on:** WP-T1 through WP-T3.

**Deliverables:**

- staff-only -> design-partner owners -> invite-only new selected-wedge businesses -> limited-availability rollout rings
- full V20 scenario, support runbooks, incident ownership, cohort observation, and rollback drills
- activation, four-week retained operation, paid conversion/renewal, support burden, contribution margin, and early acquisition evidence
- selected-wedge buyer go-to-market evidence separate from each business's visitor-acquisition work

**Out of scope:** Search/paid growth or another wedge.

**Exit gate:** V20 and the full Phase 5 gate pass, including activation, four-week retained operation, paid conversion/renewal, support burden, and contribution margin. Re-enable never silently resumes runtime, reconnects a provider, or republishes.

**Rollback:** Pause cohort expansion, creation, runtime, or delivery at the narrowest safe scope. Accounts may be made explicitly read-only without deletion; existing safe public content follows the approved billing/downgrade policy.

## Phase 6: Search and Paid Growth

### WP-U — Controlled Growth Capabilities

**Outcome:** Acquire qualified outcomes without weakening consent, site quality, or measurement truth.

**Depends on:** The Phase 5 commercial/self-service gate.

**Deliverables:** Stable useful URL model, crawl/index monitoring, canonical and structured-data audits, validated intent states, consent-aware measurement, first-party attribution, outcome reconciliation, spend controls, and marginal contribution reporting.

**Out of scope:** Thin programmatic pages, automatic SEO promises, unrestricted ad automation, or sending personal/sensitive conversation data to advertising platforms.

**Exit gate:** V21 and the full Phase 6 gate pass. Growth is evaluated on completed qualified outcomes and economics, not conversation starts or clicks alone.

**Rollback:** Stop experiments and spend per site/campaign without affecting core Agent Site, Widget, or selected-outcome service.

## Phase 7: Wedge Expansion

### WP-V — Next-Wedge Package

**Outcome:** Add one independently validated next wedge without weakening first-wedge defaults.

**Depends on:** Durable first-wedge retention, economics, incident maturity, support capacity, and the separate parent Phase 7 **entry approval**. Similar UI is not sufficient evidence; V22 remains the implementation exit gate.

**Deliverables:** New ICP/buyer, typed truth, domain-expert safety rules, provider semantics, action/identity/confirmation matrix, privacy/regulatory review, evaluation set, pricing/support/acquisition hypothesis, coexistence plan, and separate rollout controls.

**Out of scope:** Reusing first-wedge policy, provider assumptions, evaluations, or safety defaults without independent evidence.

**Exit gate:** V22 and the complete Phase 7 gate pass.

**Rollback:** Keep the next wedge behind separate policy, evaluation, and rollout boundaries. Disabling it must not alter first-wedge data, defaults, runtime, or delivery.

## Migration and Compatibility Protocol

Every replacement follows this sequence:

1. **Expand:** add nullable columns/tables, RLS, grants, and staged indexes/constraints without changing current behavior. Changes to live tables require approved lock/statement-time budgets, representative-scale testing, non-blocking index strategy, and `NOT VALID`-then-validate constraints where appropriate.
2. **Backfill:** copy only deterministic records in bounded, idempotent, checkpointed batches with provenance. Capture writes that occur during the backfill through the approved transactional writer or change marker before validation.
3. **Validate:** compare counts, hashes, orphans, tenant ownership, permissions, and representative outcomes.
4. **Shadow read:** compute the new result without serving it; compare to the legacy result and alert on drift.
5. **Dual-compatible write:** use only where necessary, with stable idempotency and reconciliation. Never dual-execute an external provider action.
6. **Cut over:** switch one caller or explicit cohort at a time behind a server-owned control.
7. **Observe:** retain a tested mixed-version compatibility matrix across N/N-1 schema, application/API nodes, workers, webhook handlers, provider adapters, publication artifacts, and queued jobs, plus telemetry, rollback ownership, and a declared observation window.
8. **Contract:** remove legacy readers/writers only after zero-use evidence, DSAR/retention parity, preserved history, and a separate approved release.

Specific compatibility rules:

- keep `agents.surface` until every builder, runtime, import, library, automation, and reporting caller uses the canonical resolver
- backfill Automation and Internal Assistant only where unambiguous; do not automatically classify legacy widget agents as Website Agents
- keep current workspace booleans until all callers use the Product access resolver; each rollout stage has one documented authority, and compatibility updates use one transactional/idempotent mutation with fail-closed drift alerts before retirement
- do not migrate multi-agent widgets automatically
- preserve widget public keys, embed snippets, origins, sessions, messages, leads, analytics, Questions/Flywheel references, and privacy history
- do not drop widget-owned customer tables merely because new operator views can read neutral conversations
- existing Widget storage may remain an explicit legacy subsystem indefinitely if forced migration adds more risk than value
- create each migration with `supabase migration new <descriptive-name>` after migration-history reconciliation; never invent timestamps
- never combine expansion, backfill, `NOT NULL` enforcement, cutover, and legacy drop in one migration/deployment
- never add an immediately validated heavy constraint/index or one-transaction bulk backfill to a live high-volume table without measured lock/query impact and an approved staged alternative
- external provider calls stay outside short database transactions; the transaction persists intent/outbox state, not the network side effect

## Rollout and Effective-Access Model

Runtime permission is the intersection of separate controls:

1. global rollout ring
2. commercial plan entitlement
3. workspace Product access for the exact requested operation: `discover`, `create`, `view`, `edit`, `publish`, `execute`, `deliver_publicly`, `suspend`, or `restore`
4. member role/capability
5. agent lifecycle
6. channel runtime/public-delivery state
7. provider connection and policy state
8. independent legal, safety, incident, abuse, budget, or provider deny-only kill switch

Unknown/error fails closed for every requested Product access operation, including private view, suspend, and restore. Safe already-published fallback behavior follows the explicit legal/deletion/suspension/staleness policy rather than a generic boolean.

The UI may display the resolver result, but it never enforces the boundary by itself. Routes, server actions, workers, webhooks, RLS/grants, and database constraints enforce their own relevant layer.

Use explicit workspace/site allowlists and sticky session/version assignment for stateful capabilities. Do not use per-request percentage rollout for consequential actions or publication behavior.

Suggested rollout-control concepts, with exact names/mechanism frozen in WP-B:

- launcher/shell v2
- Website Agent authoring
- public Agent Site delivery
- read-only concierge
- Agent Site actions
- Customers/operator outcomes
- Website Agent Chat Widget channel
- governed Improve
- self-service creation

## Rollback Rules

- Application rollback must remain compatible with additive new schema.
- Prefer forward-fix for schema defects; never delete action, audit, publication, or consent history to simulate rollback.
- Publication rollback changes a validated pointer only after current safety, rights, provider, policy, deletion, and tombstone checks.
- Action rollback stops new work and reconciles in-flight work; it never assumes an ambiguous external effect did not happen.
- Product access re-enable restores eligibility only. It does not automatically restart runtime, reconnect a provider, re-enable a channel, or republish.
- Public-delivery rollback preserves the approved static/human-contact fallback when policy permits; deletion and legal blocks override fallback.
- Domain rollback removes the verified mapping safely and returns to the platform URL without serving another tenant.
- Legacy Widgets remain the fallback until the new channel has proven parity and an explicit operator opts into any migration.

## Required Verification Gates

This section highlights cross-package gates and is deliberately **not exhaustive**. Every applicable subsection, scenario, and phase tag in the parent roadmap's [Verification Plan](./agent-native-websites.md#verification-plan) remains mandatory.

### Authorization and tenancy

Test owner, admin, member, removed member, suspended workspace, other workspace, anonymous visitor, and scoped public token across select/insert/update/delete, RPC, views, storage, sequences, routes, workers, and webhooks. Include guessed ids/public keys, stale JWT/membership, direct Data API calls, cross-workspace foreign keys, switching agents, cache keys, logs, analytics, and exports.

Test raw privileged/service-role clients separately: Supabase service-role access bypasses RLS by design, so the gate is server-only custody, explicit application authorization/scoping, tenant constraints, auditability, and proof that no browser or public route can invoke an unscoped privileged query.

RLS must be paired with explicit grants, safe view behavior, private security-definer helpers with a fixed search path where needed, and composite tenant constraints. Source-text assertions alone do not satisfy the runtime authorization gate.

### Application, API, and supply-chain security

Verify runtime request/response schemas, CSRF, exact-origin/CORS, CSP/XSS, safe URL handling, host normalization, cache/no-store partitioning, error disclosure, secret/log redaction, dependency and secret scanning, upload/import validation, and SSRF/DNS-rebinding defenses. Provider webhooks require raw-body signature verification, timestamp tolerance, replay protection, event/account scoping, and idempotent handling. No broad anonymous table access or browser-accessible service-role operation is acceptable.

### Accessibility and public quality

Run automated browser accessibility checks plus manual keyboard, screen-reader, focus/stream-announcement, 200%/400% zoom, contrast, target-size, reduced-motion, slow-network, JavaScript-off, mobile, and selected-locale long-content scenarios. Begin in WP-J/WP-K and repeat for every affected operator/public package.

### Compatibility and reliability

Every shared runtime change must run both Agent Site and existing Widget contracts/builds/journeys. Test publication/cache failure, provider failure before and after possible commitment, duplicate/out-of-order webhooks, worker crash/restart, rate/budget exhaustion, connection revocation, database/model/stream outage, backup/restore, DSAR, domain removal, and every kill switch.

## Prohibited Shortcuts

The following require an explicit roadmap revision; they are not acceptable implementation shortcuts:

1. relabeling `surface = 'widget'` as Website Agent in the UI without a durable kind/channel model
2. treating sidebar visibility or a client feature flag as authorization
3. keeping browser-side direct inserts for Website Agent creation
4. changing an existing agent's kind in place
5. implementing an Agent Site as a hidden Widget or making `widget_id` its permanent ownership key
6. automatically converting legacy or multi-agent Widgets
7. exposing public traffic before immutable publication, scoped projection, RLS/grants, and last-known-good behavior exist
8. opening `/s` through a broad middleware exception or trusting arbitrary `Host`/`X-Forwarded-Host`
9. shipping grounded chat and the real selected consequential action in the same activation step
10. enabling a consequential provider action before durable proposal, exact confirmation, outbox, idempotency, provider evidence, reconciliation, and kill switches
11. allowing the model or browser to select credentials, accounts, resources, permissions, or success state
12. combining a major schema cutover, public traffic activation, and consequential action activation in one release
13. expanding, backfilling, enforcing required values, cutting over, and dropping legacy data in one deploy
14. dual-executing provider calls or blindly dual-writing legacy/new sessions
15. treating source-string tests, mocks, or provider happy paths as proof of RLS or reliability
16. showing nonfunctional sidebar destinations merely to make the shell look complete
17. exposing a general self-service launcher, billing, or domain automation before the Phase 3 gate
18. automatically promoting customer questions, analytics, imports, or model output into agent or public truth
19. beginning paid acquisition before the Phase 5 commercial gate
20. beginning a second wedge because its UI appears reusable

## Repository Change Map

This map identifies likely implementation areas. WP-B freezes exact ownership and naming before code begins.

| Concern | Existing areas likely to change | Likely new areas |
| --- | --- | --- |
| Test/release foundation | `package.json`, `.github/workflows/ci.yml`, `supabase/config.toml`, `tests/security/` | `tests/agent-sites/`, DB/RLS, E2E, accessibility, provider-fault fixtures |
| Agent identity/access | `src/lib/types/`, `src/lib/assistants/feature-flags.ts`, `src/lib/app/bootstrap.ts`, `src/lib/plan-limits.ts`, `src/lib/widget-limits.ts`, `src/lib/automation/executor.ts`, `src/app/actions/agents.ts`, `src/components/modals/CreateAgentModal.tsx`, agent-library/import/runtime/admin/webhook paths, surface checks/private helpers/RLS/limit triggers | `src/lib/agents/kinds.ts`, access/lifecycle resolver and transactional server creation service |
| Launcher/shell | `src/app/(app)/layout.tsx`, `src/app/(app)/agents/`, `src/app/onboarding/`, `src/lib/auth-redirect.ts`, `src/components/layout/AppShell.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/app/AppContext.tsx`, `src/components/agents/AgentViewTabs.tsx`, `src/components/ui/ModalProvider.tsx`, `src/lib/agents/builder-bootstrap.ts` | launcher, selected-agent context, shell, type-specific sidebar and route guards |
| Truth/publication | knowledge services and additive migrations | `src/lib/agent-sites/`, authenticated Agent Site APIs, publication/retrieval modules |
| Provider binding | connection schema, `src/lib/connections.ts`, `src/lib/composio.ts`, `src/lib/cal.ts`, `src/lib/google-calendar.ts`, connection routes, builder resolution, provider webhooks | business/site binding, versioned action policy, provider adapter contract |
| Public Agent Site | `src/app/layout.tsx`, `src/lib/i18n-server.ts`, `src/lib/security-headers.ts`, `middleware.ts`, `src/lib/supabase/proxy.ts`, `next.config.ts` | `src/app/(public-sites)/s/[slug]/`, public Agent Site APIs, `src/components/agent-sites/` |
| Neutral runtime/customers | widget chat/runtime, `src/lib/rate-limit.ts`, `src/lib/message-usage.ts`, `src/lib/trusted-client-ip.ts`, dashboard, analytics, leads, summaries, privacy, Flywheel, admin queries | neutral conversation repositories, public session/chat services, scoped Customers views |
| Consequential actions | current integration/runtime contracts | provider adapter, proposal/action/outbox/durable-worker/webhook/reconciliation modules |
| Chat Widget channel | `src/app/(app)/widgets/WidgetsPageClient.tsx`, Widget APIs, `apps/widget-v2` | Website Agent channel adapter and channel-scoped configuration |
| Improve | `src/app/(app)/questions/QuestionsPageClient.tsx`, `src/lib/flywheel/server.ts` | Website Agent Improve view and publication projection |
| Product access/admin | current automation/assistant toggles and admin workspace pages | audited Product access matrix/API and lifecycle controls |

## Definition of Ready for Future Coding Tasks

A work package may be selected for implementation only when:

- every listed dependency and parent-phase gate is complete
- relevant Phase 0 decisions are approved and unchanged
- scope, exclusions, migration shape, rollout cohort, exit tests, rollback owner, and evidence owner are named
- current user changes in the worktree have been inventoried and protected
- no package spans both a schema contract and an unrelated public activation merely for convenience

## Definition of Complete

The implementation plan is complete only when all applicable work packages have passed their gates. “Code merged,” “UI visible,” and “model answered correctly in a demo” are intermediate signals, not completion.

For the private concierge MVP, completion means WP-A through WP-P have passed, including one Phase 0-selected provider-evidenced outcome, safe fallback, operator controls, and private-alpha evidence. The initial product is validated only after WP-Q also passes the Phase 3 commercial/safety gate. WP-R through WP-V are earned expansion, not hidden MVP backlog.
