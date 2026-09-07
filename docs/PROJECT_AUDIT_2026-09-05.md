# Agentergroup project audit — September 5, 2026

**Follow-up: straightforward fixes completed locally.** The original audit below
describes the pre-fix state. This subsequent implementation fixes credit charging
on lock rejection (finding 1), the local lint exclusion and widget type-check/CI
gaps within finding 5, and all dependency advisories reported in finding 8. It also
restores retry after Milo setup network failures, corrects duplicated legal page
titles and generic signup copy, and removes the unused widget loader helper.

Verification after the changes: 234 tests passed, standard lint passed with no
warnings, root and widget type checks passed, both production builds passed, and
both npm audits returned zero known vulnerabilities. Seven new tests execute the
real chat route with simulated services; six fail against the original route and
all seven pass after the fix. They verify overlapping hosted/preview requests,
busy/completed rejection without charging, quota failure cleanup, and persistence
failure cleanup. These tests do not exercise live Supabase or provider accounts.

The larger publishing boundary, transactional-save, retrieval fallback,
automation recovery, cost-accounting, and staging verification work remains.
The Data processing/Subprocessors access policy is unchanged. No database
migration or production deployment was performed.

**Assessment: a substantial product foundation, with correctness and release-verification work remaining before a dependable customer launch.** The Milo direction is coherent: one AI employee, one Website Chat, workspace Knowledge, approved Connections, Leads, Analytics, and a human-reviewed improvement loop. Keep that focus. The most valuable next work is making saved state, published state, usage accounting, and failure recovery predictable.

This audit reviews the current working tree, including existing uncommitted changes. At inspection there were 100 modified tracked files and 24 untracked entries, some representing whole directories. No application code, dependencies, database state, or deployment was intentionally changed. This report is the audit deliverable.

**Scope and evidence**

Reviewed the README, Milo product guide, selected Core Architecture sections, production-readiness runbook, tester checklist, installed Next.js 16.3.0 documentation, CI/configuration, and representative authentication, provisioning, Builder, public chat, Knowledge retrieval, automation, and integration code. Ran checks and inspected the locally built public landing/signup journey. Current official Next.js/Supabase documentation and dependency advisories supplemented repository evidence.

This is a code and local-build audit, not a production penetration test or legal review. Live RLS policies, production migration history, backups, provider credentials, real tool actions, payment flows, authenticated dashboard usability, and model answer quality were not verified. Documentation statements about previous production checks were treated as historical claims.

**Verification results**

| Check | Result |
| --- | --- |
| `npm test` | 227 passed; 0 failed |
| Root TypeScript, `npx tsc --noEmit --incremental false` | Passed |
| Widget TypeScript, `npx tsc -p apps/widget-v2/tsconfig.json --noEmit` | Passed |
| `npm run build` | Passed with network access; the initial restricted attempt stalled and was stopped |
| `npm run widget:build` | Passed; JS bundle 326.12 kB, 105.31 kB gzip |
| Standard `npm run lint` | Failed: 1,553 errors and 13,522 warnings, with extensive generated-file noise under `.gemini/Jenna` |
| Scoped application/test lint | 0 errors; one unused `escapeHtml` warning in widget loader |
| Main app dependency audit | 1 high and 1 moderate affected package; both marked development dependencies |
| Widget dependency audit | 1 low affected package; marked development dependency |
| Local public HTTP checks | Landing, signup, health, privacy, robots, sitemap responded successfully; dashboard and agent API redirected anonymous callers to login |
| Browser smoke check | Landing rendered; Get started reached signup; no warnings/errors captured in that brief browser check |

The scoped lint command covered `src`, widget `src`, widget loader, middleware, Next config, and tests. Passing it does not make the standard lint command pass.

**1. P1 — Rejected overlapping widget requests consume credits**

The public chat route increments workspace usage before acquiring its session turn lock. If another turn holds the lock, the request returns `409 SESSION_BUSY` after the increment, without running the model. A race with session completion can similarly reach a rejection after charging. No compensating refund occurs in these branches.

Evidence: [chat route](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts:597), particularly quota consumption at line 600, lock acquisition at 620, and rejection at 626.

**Fix:** acquire the turn lock before consuming quota, retain reliable lock release if quota is exhausted, and add request idempotency or an explicit usage reservation model for retries. Verify two simultaneous requests produce one accepted model turn and one credit charge. This is a source-confirmed control-flow defect; no real workspace credits were spent to reproduce it.

**2. P1 — Publishing does not isolate all live capabilities from draft edits**

Public chat reads instructions/model from a published version, but `loadRuntimeContext` reads current `agent_connections`, `agent_knowledge_sources`, and `agent_knowledge_folders`. Knowledge search also resolves current attachment tables by agent ID. Saving a draft attachment change can therefore alter live retrieval before Publish/Sync.

The tool case is more consequential: a newly saved connection can enter the live connected-toolkit list even when absent from the deployed definition. The tool selector falls back to recommended tools when that toolkit has no explicit selection. This can make a newly attached toolkit's defaults available to public chat before it is published. Actual provider execution still depends on the connection, provider availability, and model behavior.

Evidence: [runtime context](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/runtime/agent-chat.ts:532), [tool default selection](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/composio.ts:997), [versioned instructions](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/widgets/runtime-config.ts:33), and [Knowledge search SQL](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/supabase/migrations/20260531160122_folder_sources_in_widget_session_search.sql:28).

**Fix:** derive the live connection/source/folder selection from the deployed version and deny toolkits absent from that version. Continue checking current connection revocation and tenant ownership. Separately define whether changes to the contents of an already published Knowledge folder are intentionally live. Verify that adding a draft connection or attachment leaves an existing deployment unchanged until publishing/syncing.

**3. P1 — Builder save and publish can partially succeed**

Builder first writes agent metadata and the draft independently, then synchronizes Connections, Knowledge, and the external trigger. Failure of a later step does not roll back successful earlier writes. Reloading after failure can also replace the user's local state with this partially saved state. Publishing separately inserts a version and updates the agent pointer; version numbering is allocated with read-latest-plus-one, which can race across editors.

Evidence: [save and publish implementation](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx:4176). The production-readiness runbook already acknowledges partial saves; this audit confirms that the implementation still has them.

**Fix:** consolidate database changes into a transactional server/RPC operation with a revision check. Handle external provider synchronization as a durable follow-up with explicit status and retries. Verify rollback after injected failures and reject stale concurrent edits without silently overwriting another editor's work.

**4. P2 — Knowledge outages silently degrade answer grounding**

Knowledge lookup has a useful eight-second timeout, but failures are logged and chat continues with no retrieved Knowledge and no structured outage signal added to the model context. Initial attachment queries also discard database errors. Customers can therefore receive a normal-looking answer when the business information was unavailable. This is a demonstrated fallback path, not proof that the model has fabricated an answer; the default Milo instructions do tell it not to invent facts.

Evidence: [attachment queries](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/runtime/agent-chat.ts:537) and [retrieval failure handling](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/runtime/agent-chat.ts:809).

**Fix:** distinguish no matching answer from unavailable Knowledge. Propagate a typed retrieval outcome, instruct Milo to defer business-specific claims when retrieval fails, and expose an operator-visible incident signal. Test timeouts, database failures, zero matches, and relevant matches separately.

**5. P2 — Automated verification is weaker than the test count suggests**

34 of the 50 test files use `readFileSync`; many assertions inspect source text instead of executing the relevant route, database transaction, or browser behavior. These checks are useful guardrails, but cannot prove tenant isolation, successful publishing, real tool permissions, or the customer journey. The quota tests pass despite finding 1 because they check ordering relative to model execution, not lock rejection.

CI also builds the widget without explicitly type-checking it. Its build script is only `vite build`, and the root TypeScript configuration excludes widget code. The separate widget type check passed in this audit, but future type regressions are not explicitly gated by CI. The standard lint command additionally traverses unrelated generated files in the current workspace.

Evidence: [quota tests](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/tests/security/message-usage.test.ts:32), [Milo tests](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/tests/milo/experience.test.ts:75), [CI](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/.github/workflows/ci.yml:25), [widget build script](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/apps/widget-v2/package.json:6), and [lint ignores](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/eslint.config.mjs:9).

**Fix:** exclude local generated workspaces from lint without excluding legitimate source, add widget type checking and dependency audit policy to CI, then add a small behavior-focused suite: two-tenant authorization, save/publish failure, simultaneous chat, hosted/embed chat, lead persistence, and reviewed-answer retrieval. Supabase documents RLS as the database enforcement layer; source inspection alone does not exercise that layer. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

**6. P2 — Automation claims have no demonstrated crash recovery**

The webhook persists an event and acknowledges it while processing runs through `after()`. The executor claims `received` events by marking them `processing`. Duplicate deliveries requeue only events still in `received`. A process termination after claiming can leave an event stuck in `processing`; no lease/reclaim worker was found in the reviewed implementation.

Evidence: [webhook scheduling/replay](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/app/api/composio/webhook/route.ts:456) and [executor claim](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/automation/executor.ts:57). Next.js documents that `after()` remains bounded by the route's platform duration. [Next.js documentation](https://nextjs.org/docs/app/api-reference/functions/after).

**Fix:** before relying on automation for time-sensitive business operations, add durable job leases, retry/reclaim handling, dead-letter visibility, and action idempotency. Replaying a job after a crash must account for an external action that may already have succeeded. Keeping automation outside the initial Milo pilot reduces immediate exposure.

**7. P2 — Model usage limits do not yet provide cost accountability**

A chat turn can run up to six tool-loop completions plus a recovery completion. The OpenRouter wrapper supplies no explicit output-token limit, and the stream accumulator preserves model/id but does not accumulate provider usage into a per-turn cost record. Message credits constrain turn count, but do not make differently sized/modelled turns comparable in cost.

Evidence: [provider request](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/openrouter.ts:49), [loop and stream accumulation](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/runtime/agent-chat.ts:854), and [recovery completion](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/lib/runtime/agent-chat.ts:1137).

**Fix:** capture usage from every completion, including recovery and failed attempts when available; assign operation/workspace/model identifiers; set reviewed output and duration limits; and report estimated cost per conversation and workspace. Verify answer quality and cost using a small, repeatable English/Swedish business-question set before changing default models. No real provider spend or profitability was measured in this audit.

**8. P2 — Dependency advisories need a reviewed refresh**

The live npm advisory check returned:

| Package | Installed | Advisory severity | Scope |
| --- | --- | --- | --- |
| `browserslist` | 4.28.2 | High | Root development dependency |
| `@humanfs/node` | 0.16.7 | Moderate | Root development dependency |
| `postcss-selector-parser` | 6.1.2 | Low | Widget development dependency |

npm reported fixes available for all three. These are tooling advisories; their presence does not establish an exploitable public endpoint. Refresh the relevant transitive dependencies deliberately and rerun both build/type/lint gates. Do not use a blanket force upgrade.

Advisories: [Browserslist memory growth](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [Browserslist custom statistics handling](https://github.com/advisories/GHSA-73wf-gq98-2v4g), [humanfs symlink copy](https://github.com/advisories/GHSA-p498-v437-472g), [selector parser recursion](https://github.com/advisories/GHSA-w9m9-85wc-3x92).

**Product and maintainability feedback**

The desktop landing page has a clear hierarchy, legible typography, an obvious action, and a useful example conversation. The one-Milo product model and reviewed-answer loop provide a coherent explanation of why a customer would keep using the product. Preserve the shared runtime and explicit primary-resource IDs rather than introducing a separate Milo backend.

The signup transition loses that clarity: its copy describes generic work organization rather than answers, leads, or bookings. The landing footer also links to Data processing and Subprocessors, but both routes return `307 /login` for anonymous visitors. Privacy's rendered title repeats the brand. These are reproduced public-journey inconsistencies, not conclusions about legal compliance. Evidence: [signup copy](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/app/login/page.tsx:87), [footer links](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/components/marketing/LandingPage.tsx:593), [Data processing route](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/app/data-processing/page.tsx:1), and [Subprocessors route](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/app/subprocessors/page.tsx:1).

For small-business onboarding, I would put a guided setup path in front of the graph: business details, Knowledge, permitted actions, a test conversation, then publish. Keep advanced configuration accessible. This is a design recommendation based on the documented product and Builder source, not an authenticated usability study. Explain manual activation and show the next required action clearly.

The Builder client is 6,622 lines; the shared runtime is 1,216 and Composio module 1,876. File length alone is not a defect, but the Builder currently combines persistence, versioning, tool resolution, graph editing, and presentation. Extract persistence and versioning first, where failure behavior needs independent testing. Incrementally parameterize Supabase clients so the generated schema types catch query drift instead of being bypassed with broad casts.

The health endpoint currently proves the web process can respond, not that Supabase, Knowledge processing, or model calls work. Retain it as a lightweight liveness check; add separate dependency probes and alerts with request correlation. External monitoring configuration was not inspected, so this audit does not claim production monitoring is absent.

A small repair UX bug also remains: `MiloSetupCard.provision` has no `try/catch/finally` around `fetch`, so a network rejection can leave its retry button disabled until reload. [Repair handler](/Users/petergorgees/Dev/Agentergroup/Agentergroup.com/src/components/milo/MiloSetupCard.tsx:16).

**Recommended order**

1. Fix quota/lock ordering, live draft capability leakage, and partial-save behavior. Add behavioral regression checks for each.
2. Make the standard release gate reproducible: clean intended changes, exclude generated local workspaces, refresh affected tooling, and include widget type checking.
3. Prove the complete customer journey in staging with two tenants, real Knowledge retrieval, hosted and embedded chat, Leads, and one explicitly controlled external action.
4. Add retrieval failure handling, usage/cost records, and actionable monitoring; define recovery for any automation offered to customers.
5. Run a small managed pilot with guided setup and measured answer quality, setup time, leads, cost, and support burden. Defer additional integrations and agent types until these measures are reliable.

The repository already contains a sensible tester release checklist. Reconcile it with current implementation and attach evidence to completed items. A successful local build and 227 passing tests are encouraging, but the findings above prevent treating them as proof of launch readiness.
