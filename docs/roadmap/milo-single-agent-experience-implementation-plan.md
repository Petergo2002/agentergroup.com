# Milo Single-Agent Experience: Implementation Plan

Last updated: 2026-08-24

Status: Implemented locally and applied to the connected Supabase project on 2026-08-12. Database invariants, UI routes, focused Milo/Website Chat shells, lint, tests, and production builds were verified after application.

Current rollout decision: the staged implementation began with the global switch off. The shipped helper now defaults Milo on when `NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED` is absent and restores classic UI only when the variable is explicitly `false`.

## 1. Goal and problem statement

Agentergroup currently exposes its internal product model directly to customers: agents, agent types, agent creation, the Agent Library, widgets, widget-agent attachment, models, drafts, published versions, and deployments. That flexibility is valuable internally, but it makes the product harder to understand for the intended small-business operator.

The target experience is one branded AI employee per workspace, provisionally named **Milo**:

- The customer sees one Milo, not an agent inventory.
- Milo keeps the existing Agent Builder, Knowledge, tools, preview, versions, leads, analytics, and Questions/Data Flywheel.
- The customer sees one Website Chat, backed by the existing widget configuration and Widget V2 runtime.
- Milo is automatically attached to the workspace's primary Website Chat.
- The customer can still choose Milo's AI model through the existing OpenRouter model picker.
- Existing multi-agent data and runtime architecture are preserved for compatibility, rollback, automations, internal assistants, and future expansion.

The core implementation principle is:

> One Milo in the customer experience; the existing composable agent and widget architecture underneath.

## 2. Success criteria

The implementation is complete only when all of the following are true:

1. A new eligible workspace receives exactly one primary Milo agent, one primary Website Chat widget, and one `widget_agents` link between them.
2. Re-running provisioning is idempotent and never creates duplicate primary resources.
3. The main sidebar uses the Milo product language and no longer exposes agent or widget inventories in Milo mode.
4. Opening **Milo** takes the customer to the existing Builder for the primary agent.
5. Opening **Website Chat** takes the customer to the existing widget editor for the primary widget.
6. Website Chat stays full-screen during stable-route loading, redirect, widget loading, repair, and editing; the global sidebar/topbar never flashes and Back returns to Home.
7. The Builder remains functional: canvas, instructions, Knowledge, tools, versions, rollback, preview, and publishing continue to work.
8. The OpenRouter model picker remains visible and functional; the selected model persists through draft save, publish, preview, and public Widget V2 execution.
9. The Website Chat editor retains appearance, behavior, greeting, quick actions, lead capture, preview, hosted link, embed snippet, and deployment controls.
10. Milo-mode customers cannot accidentally create, archive, delete, detach, or replace their primary Milo through normal product UI.
11. Existing multi-agent workspaces and their historical sessions, messages, leads, versions, and widget configuration are not deleted or silently rewritten.
12. Classic mode can be restored with a kill switch without a database rollback.
13. English and Swedish customer-facing copy are updated consistently.
14. Lint, tests, the Next.js production build, and the separate Widget V2 build pass.

## 3. Research and current repository context

### 3.1 Existing systems to reuse

- `src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx` already owns the production Builder, including draft state, canvas nodes, Knowledge, tools, instructions, prompt optimization, version publication, rollback, and automation-specific behavior.
- `src/components/agents/AgentModelPicker.tsx` already provides an OpenRouter model selector.
- `src/app/api/openrouter/models/route.ts` loads the live OpenRouter catalog and falls back to a curated catalog if OpenRouter is unavailable.
- `src/lib/openrouter-models.ts` preserves older saved model IDs through a legacy option instead of forcibly replacing them.
- `src/app/(app)/widgets/[id]/page.tsx` and `src/components/widgets/builder/` already provide the Website Chat editor.
- `src/lib/widgets.ts` already sets the runtime to `single_auto` when exactly one widget agent is attached. Widget V2 therefore already supports the intended one-Milo visitor experience without a runtime rewrite.
- `src/app/api/widgets/[id]/agents/route.ts` owns widget-agent presentation settings such as label, greeting, quick actions, and contact-form behavior.
- `src/lib/app/bootstrap.ts` owns workspace creation and workspace context.
- `src/app/api/agents/route.ts` uses the transactional `create_agent_v1` RPC and existing plan-limit enforcement.
- `src/app/api/widgets/route.ts` owns widget creation and optional agent attachment.
- `src/components/layout/Sidebar.tsx` owns desktop and mobile navigation.
- `src/app/(app)/dashboard/DashboardPageClient.tsx`, `src/components/dashboard/StatsGrid.tsx`, and `src/components/dashboard/AgentStatusList.tsx` currently expose multi-agent inventory concepts that must be replaced in Milo mode.
- `/questions`, `/knowledge`, `/leads`, `/analytics`, and `/connections` can be reused as-is functionally and relabeled where necessary.

### 3.2 Existing model behavior that must be retained

- The agent record and Builder definition both persist a `model` string.
- The current default is `openai/gpt-5-mini` through `OPENROUTER_DEFAULT_AGENT_MODEL`.
- The Builder fetches `/api/openrouter/models`, categorizes compatible models, and continues to display a previously saved model even if it is no longer in the featured list.
- Agent preview, public widget chat, internal agent chat, automation runs, and versions already read the saved agent model.

The Milo implementation must not replace this with a fixed invisible model. It may recommend a default, but customer selection remains available.

### 3.3 Relevant newer architecture

The repository contains additive Website Agent / Agent Site foundations (`agents.kind`, `agent_channels`, and `agent_site_drafts`) as well as the currently active legacy Widget V2 flow. This Milo project must not create another conversation runtime or prematurely migrate Widget V2 to Agent Site.

For this minimal-change release, Milo's primary customer-facing agent continues through the proven `surface = 'widget'` and current `widgets` / `widget_agents` path. The Milo facade must remain compatible with the future Agent Site roadmap.

### 3.4 Constraints

- Do not drop or rename the `agents`, `agent_drafts`, `agent_versions`, `widgets`, or `widget_agents` tables.
- Do not delete historical multi-agent data.
- Do not rewrite Widget V2 merely to rename the product.
- Do not automatically publish drafts or unreviewed knowledge.
- Do not let a model-catalog failure reset a saved model.
- Do not make the single-Milo launch depend on the separate Agent Site roadmap.

## 4. Product and UX contract

### 4.1 Milo-mode sidebar

The sidebar in Milo mode uses these groups and labels:

```text
MILO AI

MAIN
  Home
  Milo
  Website Chat

GROW
  Knowledge
  Leads
  Improve Milo
  Analytics

CONNECT
  Connections              (only when integrations are enabled)

Settings remains in the workspace/account area at the bottom.
```

Route mapping:

| Customer label | Stable entry route | Existing implementation reached |
| --- | --- | --- |
| Home | `/dashboard` | Existing dashboard |
| Milo | `/milo` | Primary agent's `/agents/[id]/builder` |
| Website Chat | `/website-chat` | Primary widget's `/widgets/[id]` |
| Knowledge | `/knowledge` | Existing Knowledge |
| Leads | `/leads` | Existing Leads |
| Improve Milo | `/questions` | Existing Questions/Data Flywheel |
| Analytics | `/analytics` | Existing Analytics |
| Connections | `/connections` | Existing Connections |

The redirect aliases are intentionally small. The existing resource routes remain canonical internally and available for compatibility.

### 4.2 Milo Builder UX

The existing flow-based Builder stays intact. Milo mode changes its presentation, not its runtime:

- Header eyebrow: `Milo Builder` instead of `Blueprint`.
- Primary title: `Milo`; the underlying legacy agent name is not destructively rewritten during migration.
- Tabs: `Builder` and `Test Milo` instead of generic Builder/Preview copy.
- `Save draft` becomes `Save changes`.
- `Deploy blueprint` becomes `Update Milo`.
- Agent Library submission is hidden in Milo mode.
- Agent creation, archive, permanent delete, and status inventory controls are absent from the Milo journey.
- The primary agent node remains locked on the canvas as it is today.
- The model picker remains visible in the primary agent node panel and is relabeled `AI model (via OpenRouter)`.
- Instructions, timezone, conversation starters, Knowledge nodes, tools, and end-chat behavior remain available.
- Public visitor display name remains configurable in Website Chat through `widget_agents.label`; the Milo product name and public chat label are separate concepts.

### 4.3 Model-selection UX

The model picker will use progressive disclosure without removing choice:

1. Show the currently selected model and provider.
2. Open a categorized selector with Recommended, Frontier, Fast & Affordable, and Open Models.
3. Mark the recommended default, but never change the saved model without an explicit customer action.
4. Preserve the existing legacy-model row for an older or custom saved model.
5. Show whether metadata came live from OpenRouter or from the cached fallback.
6. Explain that pricing shown is provider pricing metadata and workspace message credits still apply.

The MVP continues to offer the repository's curated, tool-compatible OpenRouter model set. A searchable arbitrary OpenRouter catalog is a separate enhancement because model/tool compatibility, privacy policy, pricing display, and provider availability require explicit validation.

### 4.4 Website Chat UX

The existing widget editor remains, with four customer-facing tabs:

| Current tab | Milo-mode label | Behavior |
| --- | --- | --- |
| Aesthetics | Appearance | Existing branding, colors, logo, theme, and language |
| Specialists | Milo Chat | Edit only Milo's public label, greeting, description, quick actions, and lead/contact behavior |
| Behavior | Behavior | Existing hosted/embedded and behavioral settings |
| Deployment | Publish | Existing preview, hosted link, embed code, origins, sync, go-live, and take-offline controls |

In `Milo Chat`:

- Remove the specialist registry.
- Remove attach, detach, reorder, and “create new agent” controls.
- Render the existing presentation form for the primary Milo only.
- If the primary link is missing, show a recoverable setup error and owner-only repair action; never render an empty destructive editor.

No Widget V2 UI rewrite is needed. With one attached agent, its existing `single_auto` mode skips specialist choice automatically.

Website Chat is a focused editor, matching Milo Builder:

- `/website-chat` and the resolved primary `/widgets/{id}` route hide the global sidebar, mobile drawer, and topbar.
- Focused presentation remains in place during redirect loading, widget loading, repair/setup, and normal editing.
- A Back control in the editor header returns to `/dashboard`.
- The exception is limited to the active workspace's primary Milo widget; classic widget detail pages retain the normal app shell.

### 4.5 Home and improvement UX

The dashboard stops emphasizing resource inventory. In Milo mode, the metric order is:

1. Leads
2. Improve Milo (open unanswered questions)
3. Connections
4. Knowledge

Recent conversations remain visible and the dashboard header links to Analytics. The current release reuses existing summary data rather than introducing a separate recommendation engine.

Additional Milo-mode behavior:

- Change dashboard shortcuts from Agents to Milo and Website Chat.
- Rename Questions page heading and sidebar label to `Improve Milo`; keep the underlying queue and APIs unchanged.
- When there is only one primary agent/widget, hide redundant `All agents` and `All widgets` filters on Questions while keeping their query parameters and server behavior for compatibility.

## 5. Architecture and data design

### 5.1 Workspace product mode

Add explicit workspace-level product state rather than guessing from names:

- `product_experience text not null default 'classic' check (product_experience in ('classic', 'milo'))`
- `primary_customer_agent_id uuid null`
- `primary_widget_id uuid null`

Use generic database column names rather than the temporary brand name so a future product rename does not require a schema migration.

Foreign keys point to `agents(id)` and `widgets(id)` with `on delete set null`. A validation trigger rejects a primary agent or widget belonging to another workspace and rejects a non-widget/archived primary customer agent.

Why explicit pointers are required:

- Selecting `the first agent` is ambiguous and unstable.
- Agent names are editable and cannot be identifiers.
- Existing workspaces may contain multiple agents and widgets.
- Analytics, Questions, and routes need one deterministic resource.
- A pointer makes repair and rollback possible without deleting data.

### 5.2 Feature kill switch

During staged implementation, add `NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED` with a default of `false`. After the rollout gate is approved, the application default becomes enabled; the current implementation is enabled unless the variable is explicitly `false`.

Milo UI is active only when:

```text
global kill switch is enabled
AND workspace.product_experience = 'milo'
AND the primary resource mapping is valid
```

If the global switch is disabled, classic navigation and list screens return immediately without changing stored data.

### 5.3 Deterministic existing-workspace backfill

The migration must not rename, archive, detach, or delete anything. It only chooses candidate pointers.

Primary widget ranking:

1. Deployed widgets before draft widgets.
2. Most recently updated widget.
3. Lowest UUID as a deterministic final tie-breaker.

Primary agent ranking:

1. An unarchived `surface = 'widget'` agent already attached to the selected primary widget.
2. Published/active before unpublished/draft.
3. Most recently updated.
4. Lowest UUID as a deterministic final tie-breaker.

Workspace eligibility:

- Zero resources: leave pointers null for idempotent provisioning, then opt into Milo after provisioning succeeds.
- Exactly one compatible customer agent and no multi-agent primary-widget configuration: backfill pointers and mark eligible for Milo.
- Multiple attached agents or ambiguous legacy customer-facing resources: keep `product_experience = 'classic'` until an owner/admin explicitly chooses the primary resources.
- Automation and assistant records do not disqualify a workspace; they remain hidden implementation capabilities unless their feature-specific UI is intentionally retained.

Produce an operator query/report listing workspaces that could not be automatically migrated and the reason.

### 5.4 Idempotent Milo provisioning

Add a transactional RPC, provisionally `provision_workspace_milo_v1`, that:

1. Validates the actor is an owner/admin member of the workspace.
2. Takes a workspace-scoped advisory transaction lock.
3. Returns existing valid primary resources when already provisioned.
4. Adopts valid backfilled candidates before creating anything.
5. Creates a `surface = 'widget'` Milo agent and its initial `agent_drafts` definition using the same defaults as `buildInitialDefinition`.
6. Creates one draft widget using existing Widget defaults.
7. Creates one `widget_agents` row linking the widget to Milo with current greeting, quick-action, and contact-form defaults.
8. Sets both workspace primary pointers and changes `product_experience` to `milo` only after every insert succeeds.
9. Returns `{ agentId, widgetId, adopted, created }`.
10. Rolls the transaction back completely on any failure.

The RPC must respect workspace access and current plan-limit invariants. If existing automation/internal records consume the current agent allowance, the migration must not silently delete them or inflate billing. The operator report must flag the workspace for entitlement remediation before Milo mode is enabled.

Create a TypeScript domain wrapper in `src/lib/milo/server.ts` so routes do not reproduce selection, authorization, or repair logic.

### 5.5 New-workspace provisioning

Update both workspace creation paths in `src/lib/app/bootstrap.ts`:

- primary workspace creation during first login
- additional workspace creation through `/api/workspaces`

After the workspace, subscription, and owner membership exist, call the idempotent provisioning service. A retry must adopt or return the resources created by the earlier attempt.

If provisioning fails:

- Do not show a half-configured Milo page.
- Keep `product_experience = 'classic'` or a null primary mapping.
- Log a server-side error with workspace ID and safe error code.
- Present the owner with a retry action.
- Do not expose SQL/provider details to the browser.

### 5.6 Compatibility behavior

- Classic-mode workspaces retain `/agents` and `/widgets` lists.
- Milo-mode `/agents` redirects to `/milo` and `/widgets` redirects to `/website-chat`.
- Direct resource URLs remain valid for bookmarks, previews, Activity links, and rollback.
- Existing automation agents continue processing webhooks and runs.
- Existing Internal Assistants remain stored and can stay behind their current workspace feature flag; they are not merged into the Milo runtime in this project.
- Existing multi-agent widgets stay classic until explicitly migrated.
- No historical session, lead, question, or message foreign key is rewritten.

## 6. Detailed implementation sequence

### Phase 0 — Characterization and release protection

Files to change or create:

- `.env.example`
- `src/lib/env.ts`
- `src/lib/milo/constants.ts` (new)
- `src/lib/milo/experience.ts` (new, pure mode/route helpers)
- characterization tests under `tests/milo/` (new)

Work:

1. Add the disabled-by-default global Milo kill switch.
2. Centralize customer-facing name constants and stable entry routes.
3. Add pure helpers for determining whether Milo mode is active and for route-active matching.
4. Capture existing model persistence, one-agent Widget V2 behavior, and classic route behavior in tests before changing UI.

Gate:

- With the flag off, rendered navigation and routes behave exactly as before.

### Phase 1 — Workspace identity, migration, and provisioning

Files to change or create:

- `supabase/migrations/<timestamp>_milo_primary_workspace_resources.sql` (new)
- `src/lib/supabase/database.types.ts` (regenerate after migration)
- `src/lib/types/workspace.ts`
- `src/lib/app/bootstrap.ts`
- `src/lib/milo/server.ts` (new)
- `src/app/api/milo/provision/route.ts` (new, owner/admin repair endpoint)
- `src/app/api/workspaces/route.ts`

Work:

1. Add product mode and primary-resource columns, foreign keys, validation, indexes, and the migration report query.
2. Implement deterministic backfill without mutating legacy resources.
3. Implement the idempotent transactional provisioning RPC.
4. Wrap the RPC with workspace-scoped TypeScript helpers.
5. Provision Milo from both workspace creation paths.
6. Add a repair endpoint that returns stable error codes and never accepts arbitrary cross-workspace agent/widget IDs.
7. Regenerate Supabase types and update `WorkspaceRecord`.

Gate:

- New workspace: one agent, one draft, one widget, one link, two pointers.
- Repeated/concurrent provisioning: still one of each.
- Foreign-workspace IDs and unauthorized members are rejected.
- Ambiguous legacy workspaces remain classic and unchanged.

### Phase 2 — Stable Milo and Website Chat routes

Files to change or create:

- `src/app/(app)/milo/page.tsx` (new)
- `src/app/(app)/website-chat/page.tsx` (new)
- `src/app/(app)/milo/loading.tsx` (new if the route performs resource resolution)
- `src/app/(app)/website-chat/loading.tsx` (new)
- `src/app/(app)/agents/page.tsx`
- `src/app/(app)/widgets/page.tsx`
- `src/components/layout/AppShell.tsx`

Work:

1. Resolve primary resources server-side from authenticated workspace context.
2. Redirect valid Milo routes to the existing resource editor pages.
3. Show an owner-only repair screen for a missing/invalid mapping; non-owners receive a clear admin-contact state.
4. Redirect legacy inventory routes only in Milo mode.
5. Extend focused-route and active-navigation logic so the Milo sidebar remains selected after redirecting to `/agents/[id]/builder` or `/widgets/[id]`.
6. Prevent redirect loops from editor breadcrumbs.

Gate:

- Milo and Website Chat always resolve inside the active workspace and never leak or open another workspace's resource.

### Phase 3 — Sidebar and product-language migration

Files to change:

- `src/components/layout/Sidebar.tsx`
- `src/components/layout/WorkspaceSwitcher.tsx` only if its Settings naming/context needs adjustment
- `src/locales/en/nav.ts`
- `src/locales/sv/nav.ts`
- relevant common/status locale modules discovered during implementation

Work:

1. Render the new grouped Milo sidebar only when effective Milo mode is active.
2. Preserve the classic sidebar behind the kill switch/workspace mode.
3. Add active-prefix support rather than relying only on `pathname.startsWith(item.href)`.
4. Keep lead and analytics attention badges.
5. Keep Connections conditional on `integrations_enabled`.
6. Hide Agents, Widgets, Agent Library, and Assistants from the Milo-mode global navigation.
7. Preserve keyboard focus, collapsed tooltips, mobile drawer behavior, and accessible labels.

Gate:

- Desktop, collapsed desktop, tablet, and mobile navigation show the same information architecture and correct active state.

### Phase 4 — Milo-brand the existing Builder without reducing capability

Files to change:

- `src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx`
- `src/components/agents/AgentViewTabs.tsx`
- `src/components/agents/AgentModelPicker.tsx`
- `src/app/(app)/agents/[id]/preview/page.tsx`
- `src/locales/en/agentBuilder.ts`
- `src/locales/sv/agentBuilder.ts`
- `src/locales/en/agents.ts`
- `src/locales/sv/agents.ts`

Work:

1. Derive `isPrimaryMilo` from active workspace context and the loaded agent ID.
2. Change only presentation for the primary Milo; automation/assistant/legacy non-primary editors keep their current copy.
3. Hide Agent Library publication for Milo.
4. Protect primary Milo from archive/delete UI entry points.
5. Rename save, publish, header, and preview copy as specified.
6. Keep the flow canvas and all existing nodes.
7. Keep `AgentModelPicker` visible; relabel it and add concise OpenRouter/privacy/pricing helper text.
8. Preserve legacy saved models and fallback behavior.
9. Ensure model changes participate in dirty-state detection, save, version publication, rollback, and preview exactly as before.

Gate:

- Change Milo from one OpenRouter model to another, save, publish, refresh, preview, and verify the same model ID at every stage.

### Phase 5 — Convert Widget editor into Website Chat

Files to change:

- `src/app/(app)/widgets/[id]/page.tsx`
- `src/app/(app)/widgets/[id]/loading.tsx`
- `src/app/(app)/website-chat/loading.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/milo/MiloSetupCard.tsx`
- `src/components/widgets/builder/WidgetBuilderHeader.tsx`
- `src/components/widgets/builder/WidgetBuilderContext.tsx`
- `src/components/widgets/builder/tabs/AgentsTab.tsx`
- `src/components/widgets/builder/tabs/AppearanceTab.tsx`
- `src/components/widgets/builder/tabs/BehaviorTab.tsx`
- `src/components/widgets/builder/tabs/DeploymentTab.tsx`
- `src/app/api/widgets/[id]/agents/route.ts`
- `src/app/api/widgets/[id]/route.ts` if primary-resource protection is needed there
- `src/locales/en/widgets.ts`
- `src/locales/sv/widgets.ts`
- the `widgetBuilder` English/Swedish locale modules

Work:

1. Detect whether the loaded widget is the active workspace's primary widget.
2. Rename the editor and tabs only for that widget in Milo mode.
3. In Milo Chat, render only the primary Milo presentation form.
4. Remove attach/detach/reorder/create controls from Milo mode while retaining classic implementation for rollback.
5. Add server enforcement: a Milo-mode save may update the primary link's presentation fields but may not submit arbitrary agent IDs or remove the primary link.
6. Preserve Appearance, Behavior, Publish, preview, hosted URL, embed snippet, origin validation, and sync logic.
7. Keep Widget V2 unchanged unless a regression test exposes a single-agent issue.
8. Keep `/website-chat` and the resolved primary widget in the focused full-screen shell for loading, repair, and editing.
9. Add a Back-to-dashboard control without changing classic widget-detail navigation.

Gate:

- Website Chat appearance and Milo presentation changes preview correctly, save correctly, deploy correctly, and render in both hosted and embedded Widget V2.

### Phase 6 — Dashboard, Improve Milo, and secondary surfaces

Files to change:

- `src/app/(app)/dashboard/DashboardPageClient.tsx`
- `src/components/dashboard/StatsGrid.tsx`
- `src/components/dashboard/AgentStatusList.tsx` (replace or branch to a Milo attention component)
- `src/lib/dashboard/summary.ts`
- `src/app/(app)/questions/QuestionsPageClient.tsx`
- relevant dashboard/questions locale modules in `src/locales/en/` and `src/locales/sv/`
- `src/app/(app)/settings/billing/page.tsx`

Work:

1. Return primary Milo and Website Chat state from dashboard summary without removing classic fields prematurely.
2. Replace inventory metrics and status lists only in Milo mode.
3. Build the attention list from existing data; do not add a second analytics or recommendation system.
4. Relabel Questions to Improve Milo and hide redundant primary-resource filters in Milo mode.
5. Update plan descriptions so they no longer sell “3 agents,” “unlimited agents,” or multiple widgets while the Milo product exposes one customer-facing instance. Decide plan differentiation through messages, storage, integrations, team size, and capabilities.
6. Keep Admin and historical analytics capable of displaying underlying resource IDs/names for operations.

Gate:

- Every Milo-mode dashboard element links to an action the customer can actually complete.

### Phase 7 — Product invariant hardening

Files to change:

- `src/app/api/agents/route.ts`
- `src/app/api/agents/[id]/archive/route.ts`
- `src/app/api/agents/[id]/route.ts`
- `src/app/api/agent-library/[id]/import/route.ts`
- `src/app/api/widgets/route.ts`
- widget delete/status routes as applicable
- supporting migration functions/triggers from Phase 1

Work:

1. In Milo mode, reject normal creation of a second customer-facing widget agent with stable code `milo_agent_already_exists`.
2. Reject creation of a second primary Website Chat with `primary_widget_already_exists`.
3. Prevent archive/delete of the primary Milo and delete/replacement of the primary Website Chat unless the workspace first exits Milo mode through an explicit admin migration path.
4. Keep Automation and Internal Assistant compatibility separate from the customer-facing Milo uniqueness rule.
5. Ensure direct API calls cannot bypass the UI invariant.
6. Preserve classic-mode behavior for rollback and unresolved legacy workspaces.

Gate:

- Browser UI, direct route calls, and concurrent requests all preserve one primary customer agent and one primary widget in Milo mode.

### Phase 8 — Documentation, rollout, and cleanup

Files to change or create:

- `README.md`
- `docs/README.md`
- `docs/architecture/core.md`
- `docs/guides/milo-experience.md` (new operator/developer guide)
- `docs/runbooks/operations.md`
- `docs/runbooks/production-readiness.md`
- `.env.example`

Work:

1. Document the product facade versus internal resources.
2. Document provisioning, repair, classic fallback, model selection, and legacy workspace migration.
3. Add deployment order: database migration, app deploy with flag off, backfill audit, pilot workspace opt-in, flag enablement, then broad opt-in.
4. Update route and billing documentation.
5. Remove dead list-only imports/components only after the rollback window ends; do not delete classic code during the first release.

Gate:

- An operator can identify a workspace's mode and primary IDs, repair it, return it to classic UI, and verify the selected OpenRouter model without inspecting browser state.

## 7. Edge cases and safe behavior

### 7.1 Workspace has no agents or widgets

- Owner/admin may provision Milo.
- Regular members see a message asking an administrator to finish setup.
- Provisioning is transactional and idempotent.

### 7.2 Workspace has one agent but no widget

- Adopt the compatible unarchived widget-surface agent.
- Create and attach a primary widget.
- Preserve the agent's name, model, instructions, drafts, versions, Knowledge, and connections.

### 7.3 Workspace has a widget but no attached agent

- Adopt the primary widget.
- Create Milo if entitlement allows.
- Attach Milo without changing widget branding, public key, hosted URL, embed snippet, or deployment history.

### 7.4 Workspace has multiple agents or a multi-agent widget

- Do not auto-enable Milo mode.
- Do not detach agents or rewrite historical references.
- Produce a migration report and require an explicit primary selection/confirmation.
- Classic UI stays available until resolved.

### 7.5 Primary agent is archived/deleted or widget is deleted

- UI routes treat the mapping as invalid and enter repair state.
- API guards prevent the normal destructive action.
- `on delete set null` prevents dangling foreign keys if an operator performs an exceptional deletion.
- Repair adopts a valid resource before creating a replacement.

### 7.6 OpenRouter is unavailable

- Model selector uses the curated fallback.
- Current saved model remains selected even when absent from the fallback.
- Save/publish never resets the model because catalog loading failed.
- Chat failures continue using existing stable public error handling.

### 7.7 Selected model is removed or loses tool support

- Existing saved ID remains visible as the current/legacy model.
- The customer receives a warning before changing or republishing, but the system does not silently substitute another model.
- Runtime/provider errors remain observable through existing run diagnostics.

### 7.8 Plan limit is already consumed

- Do not delete automation/assistant records.
- Do not silently increase billing entitlements.
- Keep the workspace classic and surface a stable operator remediation reason.
- Product plan copy and future entitlement rules must distinguish the guaranteed primary Milo from optional internal automation capacity.

### 7.9 Team-member permissions

- Existing `canEditAgentRecord` and workspace roles remain authoritative.
- Members may view/use Milo according to existing permissions.
- Only owner/admin can provision or repair primary mappings.
- No client-provided workspace, agent, or widget ID is trusted without server-side workspace verification.

### 7.10 Language and branding

- Milo is the fixed product identity in navigation and headers.
- Public chat display label remains editable and may be localized.
- English and Swedish strings ship together; no hardcoded user-facing English is added to modified components.

## 8. Security and privacy considerations

- New provisioning and repair operations must use authenticated server context and explicit workspace membership checks.
- Primary-resource IDs must be validated against the active workspace before redirecting.
- The OpenRouter model endpoint must continue returning metadata only; never expose `OPENROUTER_API_KEY`.
- Existing OpenRouter privacy preferences (`OPENROUTER_DATA_COLLECTION`, `OPENROUTER_REQUIRE_ZDR`) remain server-controlled and are not weakened by model selection.
- Model choice must not bypass tool compatibility or production privacy policy.
- Widget access tokens, preview tokens, origin enforcement, rate limiting, upload hardening, and session locks remain unchanged.
- Provisioning failures log safe identifiers and error codes, not raw provider payloads or secrets.
- Do not store raw debug traces or tool payloads as part of the Milo facade.

## 9. Verification plan

### 9.1 Migration and database verification

Using a disposable/local Supabase database:

1. Apply all migrations from zero.
2. Verify new columns, constraints, functions, grants, and generated types.
3. Provision a new workspace and assert exact row counts.
4. Call provisioning twice and concurrently; assert the same IDs return.
5. Attempt cross-workspace primary pointers; assert rejection.
6. Attempt unauthorized provisioning; assert rejection.
7. Backfill fixtures for zero, one, multiple, archived, automation-only, and multi-agent-widget cases.
8. Confirm ambiguous workspaces remain classic and unchanged.
9. Confirm rollback/kill-switch use does not delete primary mappings.

### 9.2 Automated application tests

Add tests for:

- effective Milo-mode calculation
- deterministic candidate ranking
- route redirect and repair decisions
- active sidebar matching after resource redirects
- provisioning response/error normalization
- primary-resource API guards
- OpenRouter live/fallback/legacy selection behavior
- model dirty state and persisted definition serialization
- Milo-mode widget-agent payload validation
- classic-mode compatibility

Update the test command so the new test directory is included rather than relying only on `tests/security/*.test.ts`.

### 9.3 End-to-end scenarios

Run these scenarios in English and Swedish where copy differs:

1. New owner activation -> Home -> Milo -> select model -> save -> test -> publish.
2. Milo -> add Knowledge and a connected tool -> test grounded/tool response.
3. Website Chat -> Appearance -> Milo Chat -> Behavior -> Preview -> Publish.
4. Enter through `/website-chat`; verify no sidebar/topbar appears during redirect or loading, then verify Back returns to `/dashboard`.
5. Open hosted link and embedded loader; verify the chat opens directly without specialist choice.
6. Submit lead -> verify Leads and conversation summary.
7. Ask an unanswered question -> verify Improve Milo queue -> publish verified answer -> retest Milo.
8. Refresh every route and switch workspaces; verify active workspace isolation.
9. Disable the Milo kill switch; verify classic lists return.
10. Open legacy deep links; verify they continue to work.
11. Simulate OpenRouter model-catalog failure; verify fallback and saved-model preservation.

### 9.4 Release gates

Run:

```bash
npm run lint
npm test
npm run build
npm run widget:build
```

Also verify:

- no unexpected migration advisor/RLS regressions
- no unauthenticated access to new routes or RPCs
- keyboard operation and focus visibility for sidebar, Builder tabs, and model picker
- mobile drawer and narrow widget editor behavior
- no public Widget API contract changes
- deployment of `apps/widget-v2` is unnecessary unless its source actually changes

## 10. Rollout and rollback

### Rollout

1. Ship database additions and classic-compatible application code with the global flag off.
2. Run the migration eligibility report.
3. Provision and opt in internal/test workspaces.
4. Validate model choice, hosted Widget V2, embed Widget V2, leads, Questions, and analytics.
5. Opt in a small pilot group of eligible single-agent workspaces.
6. Monitor provisioning errors, redirect errors, chat failures, lead capture, and model/provider failures.
7. Enable Milo by default for newly created workspaces.
8. Migrate remaining eligible workspaces.
9. Handle multi-agent legacy workspaces individually.
10. Only after the rollback window, consider retiring classic list UI from the main bundle.

### Rollback

1. Disable `NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED`.
2. Classic sidebar and `/agents` / `/widgets` inventories return.
3. Do not roll back primary pointer columns or delete provisioned resources.
4. Existing widget public keys, deployments, sessions, and model selections continue working.
5. Correct the fault, re-enable only test workspaces, and repeat the release gates.

## 11. Explicit non-goals

This implementation does not:

- collapse the database to a literal single `agents` row globally
- delete multi-agent support
- merge Automation Agent and Internal Assistant runtimes into Milo
- replace the flow-based Agent Builder
- replace Widget V2
- implement the complete Agent Site/custom-domain roadmap
- automatically generate or publish unreviewed business claims
- expose OpenRouter credentials
- promise that every OpenRouter model is safe or compatible with tools
- remove versioning, rollback, preview, or deployment controls

## 12. Final acceptance checklist

- [x] New workspace provisions one primary Milo and Website Chat atomically.
- [x] Provisioning is idempotent and concurrency-safe.
- [x] Existing ambiguous multi-agent workspaces are unchanged and remain classic.
- [x] Milo-mode sidebar matches the approved information architecture.
- [x] `/milo` and `/website-chat` resolve only active-workspace resources.
- [x] Existing Builder remains intact and is correctly Milo-branded.
- [x] OpenRouter model selection remains visible, saved, published, previewed, and executed.
- [x] Existing Website Chat editor and Widget V2 behavior remain intact.
- [x] Website Chat is full-screen across loading, repair, and editing, with a working Back-to-dashboard control.
- [x] Specialist attach/detach/create controls are absent in Milo mode.
- [x] Primary resources are protected in UI and APIs.
- [x] Dashboard and Questions use outcome-focused Milo language.
- [x] English and Swedish copy are complete.
- [x] Classic kill-switch rollback is verified.
- [x] No historical customer data is deleted or rewritten.
- [x] Lint, automated tests, Next.js build, and Widget V2 build pass.
- [x] Architecture, operator, and production docs are updated.
