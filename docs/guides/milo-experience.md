# Milo single-agent experience

Last updated: 2026-09-07

## Product contract

Milo is the primary customer-facing product model for Avenro. A Milo workspace presents one AI employee and one Website Chat. Customers improve that same Milo instead of creating and prompting multiple separate chat agents.

Milo is a product facade, not a destructive database rewrite. The existing `agents`, drafts, versions, widgets, widget-agent links, OpenRouter model selection, and Widget V2 runtime remain authoritative underneath. This keeps the change small, preserves historical data, and allows the backend to make Milo smarter without forcing customers to rebuild it.

The current product loop is:

```text
Configure Milo
  -> add Knowledge and Connections
  -> configure and publish Website Chat
  -> receive conversations and Leads
  -> review Analytics and unanswered questions
  -> teach Milo verified answers in Improve Milo
  -> publish the improved Milo
```

## Customer navigation

Effective Milo mode uses this sidebar:

```text
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
  Connections       shown only when integrations are enabled

Settings remains in the workspace/account area.
```

The main surfaces have distinct jobs:

| Surface | Customer purpose |
| --- | --- |
| Home | See Leads, unanswered questions, connected apps, Knowledge, recent conversations, and Milo attention shortcuts |
| Milo | Configure behavior, instructions, model, Knowledge, tools, conversation starters, and test chat |
| Website Chat | Configure what website visitors see and publish the hosted or embedded chat |
| Knowledge | Add approved business information Milo can retrieve |
| Leads | Review contacts and AI-generated conversation summaries |
| Improve Milo | Answer questions Milo could not handle confidently and turn approved answers into Knowledge |
| Analytics | Review customer conversations and performance |
| Connections | Authorize external apps Milo may use through approved tool nodes |

## Workspace state and effective mode

`workspaces.product_experience` is either `classic` or `milo`. Milo workspaces also store:

- `primary_customer_agent_id`
- `primary_widget_id`

Names are editable, so code must never infer primary resources from the text `Milo`, an agent name, or a widget name.

Milo UI is effective only when all of the following are true:

1. `NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED` is not explicitly `false`.
2. `workspace.product_experience = 'milo'`.
3. Both primary resource IDs are present.

Setting the global switch to `false` restores classic navigation and inventories without deleting mappings, sessions, leads, versions, deployments, or public widget keys.

## Stable routes and focused editors

- `/milo` resolves to `/agents/{primary_customer_agent_id}/builder`.
- `/website-chat` resolves to `/widgets/{primary_widget_id}`.
- `/agents` and `/widgets` redirect to those stable entries only in effective Milo mode.
- Direct resource routes remain valid for compatibility, previews, versions, activity, bookmarks, and rollback.

Both Milo Builder and Website Chat use the focused application shell. They retain `AppContextProvider`, SWR, toasts, and modals, but hide the global desktop sidebar, mobile drawer, and topbar.

Website Chat remains full-screen through every visible state:

- `/website-chat` redirect loading
- primary widget data loading
- missing-resource repair/setup
- the loaded editor

Its header includes a Back control to `/dashboard`. The focused shell is scoped to the primary Milo widget; classic `/widgets/{id}` pages keep the normal app shell.

## Milo Builder

Milo reuses the existing flow-based Agent Builder. The Milo presentation changes customer language while keeping the runtime and persistence model intact.

The top header includes an elevated **Liquid Glass Segmented Switch** (`AgentViewTabs`) that seamlessly toggles between **BUILDER** (`/agents/[id]/builder`) and **TEST MILO** (`/agents/[id]/preview`) with instant optimistic click feedback and hardware-accelerated spring animations.

Customers can still configure:

- instructions and identity
- an OpenRouter model
- timezone
- conversation starters
- Knowledge sources and folders
- supported connected tool nodes
- end-chat behavior
- preview/test chat
- draft save, publishing, version history, and rollback

The model remains customer-selectable. The live OpenRouter catalog can fall back to the curated catalog, and an older saved model remains visible rather than being silently replaced.

Milo mode hides inventory-oriented or destructive actions such as creating another customer-facing agent, publishing Milo to the Agent Library, archiving the primary Milo, or permanently deleting it. Automation Agents and Internal Assistants remain separate capabilities and are not merged into Milo.

## Website Chat

Website Chat reuses the current widget editor and Widget V2 runtime. Its Milo-mode tabs are:

| Tab | Purpose |
| --- | --- |
| Appearance | Brand name, logo, colors, theme, and language |
| Milo Chat | Milo's public display label, description, greeting, placeholder, conversation starters, and contact-form behavior |
| Behavior | Chat behavior and customer-facing settings |
| Publish | Preview, hosted link, embed code, allowed origins, sync, go live, and take offline |

The primary Website Chat has exactly one attached Milo in the customer experience. Attach, detach, reorder, specialist registry, and create-agent controls are hidden and protected. With one attached agent, Widget V2 uses its existing `single_auto` mode and opens directly into the conversation instead of asking visitors to choose a specialist.

Widget V2 consistently presents the Milo mark and product name in the public launcher, home identity, typing state, and assistant-message attribution. The editable widget-agent presentation still controls greetings, descriptions, placeholders, quick actions, contact-form behavior, and other visitor copy. Message copy actions show localized success feedback and retain a fallback for iframe environments where the Clipboard API is unavailable.

The authenticated Website Chat builder (`/widgets/[id]`) features a dedicated full-width studio workspace designed for low-friction, uncrowded editing:

- **Left Configuration Column (`420px–480px`):** Clean, spacious controls organized across the 4 primary tabs (`Appearance`, `Milo Chat`, `Behavior`, and `Publish`) with curated color palettes, brand logo uploaders with instant removal, and visual theme selection.
- **Right Live Studio Canvas:** Expansive, edge-to-edge preview stage featuring:
  - **Desktop View:** An ambient dot-grid studio stage rendering the **canonical Milo floating launcher bubble** and floating chat window.
  - **Mobile View:** A centered smartphone chassis previewing the native mobile chat experience.
  - **The Canonical Milo Launcher:**
    - **Closed State:** A 56px (`h-14`) pill in the widget's configured primary color, containing a 40px circular white container with the canonical `MiloLogo` (or custom brand logo), a vertical divider line, and the white "Milo" product name.
    - **Open State:** Morphs into the canonical 56px circular white button with a clean `✕` icon, floating below the live widget window.
    - **Interactive Sync:** Clicking the bubble expands the chat; clicking the close `✕` button or the close icon inside the widget header collapses the chat back into the launcher pill.
- **Bidirectional Live Sync:**
  - Real-time draft theme and color changes flow into the live iframe via `ag:widget-preview:update-config` without reloading.
  - Preview credentials rotate via `ag:widget-preview:update-auth` without resetting active conversations.
  - Open/close state is kept in sync bidirectionally via `ag:widget:state` and `ag:widget:close-request`.
  - In preview mode (`preview=1`), Widget V2 directly bootstraps its configuration from `/api/public/widgets/[widgetPublicKey]/bootstrap` with signed preview headers, eliminating loader dependencies and preventing iframe hangs.

Website Chat may be used in either currently supported form:

- hosted standalone chat through the Widget V2 deployment
- embedded chat through the loader snippet on an existing website

The future Agent Site/native website may use the same Milo, Knowledge, Connections, conversations, Leads, and improvement loop. It is a separate roadmap and is not implemented by the current Website Chat route.

## Knowledge, Connections, Leads, and Improve Milo

These are capabilities of the same Milo rather than separate agents:

- Knowledge is workspace-scoped but attached to Milo through the existing Builder definition and attachment tables.
- Connections authorizes external accounts at the workspace level; Milo uses only the approved tools attached in Builder.
- Leads come from Website Chat and retain their session, transcript, and summary relationships.
- Analytics reads the existing widget conversation and automation records.
- Improve Milo uses the existing Questions/Data Flywheel. Approved answers create verified facts and normal Knowledge sources; nothing is published automatically without review.

This separation lets the backend improve retrieval, prompts, model routing, tool policies, evaluations, summaries, and the data flywheel while keeping the customer experience centered on one Milo.

## Provisioning and repair

`public.provision_workspace_milo_v1(workspace_id, actor_id)` is service-role-only. It:

1. verifies that the actor is an owner/admin member
2. takes a workspace transaction lock
3. adopts unambiguous compatible resources when possible
4. creates missing primary resources
5. links the primary widget and agent
6. writes both primary pointers
7. opts the workspace into Milo only after the transaction succeeds

The function is idempotent and refuses to guess when multiple customer-facing agents, widgets, or links are ambiguous. Normal setup runs after workspace membership creation. Owners/admins can retry through `POST /api/milo/provision`; the browser never supplies arbitrary resource IDs.

If setup is incomplete, the Milo and Website Chat routes show the shared setup/repair state. Members are asked to contact an admin; owners/admins can retry provisioning.

## Invariants and compatibility

Application routes and database triggers prevent a Milo workspace from:

- creating a second customer-facing Milo agent
- creating a second primary Website Chat
- archiving or deleting the primary Milo
- deleting or moving the primary Website Chat
- removing or replacing the primary widget-agent link

Classic-mode behavior is intentionally preserved:

- ambiguous legacy multi-agent workspaces remain classic
- classic agent and widget inventories remain available behind workspace mode and the kill switch
- historical sessions, messages, leads, questions, versions, public keys, and deployments are not rewritten
- Automation Agents and Internal Assistants remain separate records and runtimes

## Main implementation files

- `src/lib/milo/experience.ts` — effective mode and stable navigation matching
- `src/lib/milo/server.ts` — typed provisioning wrapper and safe errors
- `src/app/(app)/milo/page.tsx` — stable Milo resolver
- `src/app/(app)/website-chat/page.tsx` — stable Website Chat resolver
- `src/app/(app)/website-chat/loading.tsx` — focused Website Chat transition state
- `src/components/layout/AppShell.tsx` — classic versus focused shell selection
- `src/components/layout/Sidebar.tsx` — Milo information architecture
- `src/components/widgets/builder/WidgetBuilderContext.tsx` — primary Website Chat detection
- `src/components/widgets/builder/WidgetBuilderHeader.tsx` — Website Chat title, tabs, deployment actions, and Back control
- `src/components/widgets/builder/WidgetDevicePreview.tsx` — live draft overrides and preview-credential rotation
- `src/components/milo/MiloSetupCard.tsx` — setup and repair UI
- `apps/widget-v2/src/components/MiloMark.tsx` — shared Milo identity inside the public runtime
- `apps/widget-v2/src/lib/postmessage.ts` — validated preview and loader message contracts
- `src/lib/app/bootstrap.ts` — new-workspace Milo provisioning
- `supabase/migrations/20260811221031_milo_primary_workspace_resources.sql` — state, provisioning RPC, guards, and audit query

## Rollout, rollback, and verification

The migration was applied to the connected Supabase project and verified on 2026-08-12. For another environment:

1. Apply `20260811221031_milo_primary_workspace_resources.sql`.
2. Deploy with the global flag off when a staged rollout is required.
3. Audit classic workspaces with the operator query at the end of the migration.
4. Verify Milo save/publish/preview, Website Chat hosted/embed behavior, Leads, Improve Milo, Analytics, Knowledge, and Connections.
5. Verify `/website-chat` never displays the global sidebar during loading or after redirect and that Back returns to `/dashboard`.
6. Enable the flag for the intended environment.

Rollback is UI-only: set `NEXT_PUBLIC_MILO_EXPERIENCE_ENABLED=false`. Do not delete primary mappings or resources.

Release checks:

```bash
npm run lint
npm test
npm run build
npm run widget:build
```

After applying the migration, run Supabase security and performance advisors and confirm that the provisioning RPC is executable only by `service_role`.
