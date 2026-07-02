# Plan: Build The Data Flywheel First

## Summary

Start with the learning loop, not the mini-site.

The MVP should make the existing widget smarter by turning missed visitor questions into verified customer-approved knowledge:

Visitor asks something the agent cannot answer well -> question appears in dashboard -> customer answers -> answer becomes verified fact -> RAG is updated -> agent answers better next time.

The mini-site, FAQ, JSON-LD, sitemap, and `llms.txt` should be built later on top of the same `verified_facts` data.

## Product Job

Primary user:
- Workspace member responsible for improving an agent's answers.

Primary object:
- An unanswered visitor question.

Highest-value action:
- Add a verified answer and publish it to the agent.

Recurring workflow:
1. Review new unanswered questions.
2. Understand the visitor context.
3. Write or edit a concise verified answer.
4. Publish the answer to the agent's knowledge.
5. Confirm processing status and fix failures if needed.

UX principle:
- The dashboard must behave like an operational queue, not a marketing page or generic content manager.

## Current State

Already available:
- Widget chat runtime via `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`.
- Widget sessions/messages in Supabase.
- Knowledge/RAG tables: `knowledge_sources`, `knowledge_chunks`, `agent_knowledge_sources`.
- Edge Functions: `process-knowledge-source` and `search-knowledge`.
- Dashboard/analytics/leads surfaces where this feature can fit.
- Supabase RLS enabled on relevant tables.
- Supabase MCP available for `list_tables`, `get_advisors`, Edge Function inspection, and verification.

Important architecture note:
- `knowledge_sources.widget_session_id` already exists for session knowledge.
- Flywheel answers must not be stored as temporary session knowledge.
- Customer-approved answers should become permanent agent-linked knowledge through `agent_knowledge_sources`.

## Implementation Plan

### 1. Database Foundation

Create a new migration with two tables.

`unanswered_queries`
- Purpose: queue for questions the agent could not answer confidently.
- Fields: `id`, `workspace_id`, `widget_id`, `widget_agent_id`, `agent_id`, `widget_session_id`, `user_message_id`, `assistant_message_id`, `question`, `assistant_answer`, `context_excerpt`, `detection_reason`, `confidence`, `status`, `duplicate_of`, `dedupe_hash`, `created_at`, `updated_at`, `resolved_at`.
- Status: `open`, `answered`, `dismissed`, `duplicate`.
- Indexes: `(workspace_id, status, created_at desc)`, `(agent_id, status)`, `(widget_session_id)`, dedupe index for open questions.

`verified_facts`
- Purpose: customer-approved facts used for RAG now and SEO/FAQ later.
- Fields: `id`, `workspace_id`, `agent_id`, `unanswered_query_id`, `created_by`, `question`, `answer`, `status`, `visibility`, `knowledge_source_id`, `metadata`, `created_at`, `updated_at`, `published_at`, `retired_at`.
- Status: `draft`, `published`, `retired`.
- Visibility: `agent_only` now, `public_ready` later for mini-site.
- `knowledge_source_id` links to the created RAG source.

RLS:
- Workspace members can read.
- Only workspace members with agent edit permission can answer, dismiss, duplicate, reopen, publish, retire, or edit.
- Public widget route creates `unanswered_queries` through the service/admin client, not anonymous client access.

Supabase workflow:
- Run `list_tables` before schema work.
- Use local migrations first.
- Run `get_advisors security` and `get_advisors performance` after migration.
- Do not use MCP `apply_migration` against production without explicit approval.

### 2. Shared Server Helpers

Create a feature module, for example `src/lib/flywheel`.

It should contain:
- `createUnansweredQueryCandidate`
- `dedupeUnansweredQuery`
- `publishVerifiedAnswer`
- `createKnowledgeSourceFromVerifiedFact`
- `linkKnowledgeSourceToAgent`
- `queueKnowledgeProcessing`

Extract reusable logic from the current knowledge route so normal text knowledge and flywheel answers use the same path for:
- creating `knowledge_sources`
- reserving storage when needed
- triggering `process-knowledge-source`
- handling failures

Important:
- Insert/upsert into `agent_knowledge_sources`.
- Do not replace the agent's existing knowledge sources.

### 3. Dashboard APIs

Create authenticated routes.

`GET /api/flywheel/unanswered`
- Returns queries for the active workspace.
- Filters: `status`, `agentId`, `widgetId`, `confidence`, `from`, `to`.
- Default: open questions, newest first.

`GET /api/flywheel/unanswered/[id]`
- Returns one query with assistant answer, context excerpt, session metadata, and linked verified fact if one exists.
- Used by the detail drawer/panel.

`POST /api/flywheel/unanswered/[id]/answer`
- Validates workspace and agent edit permission.
- Accepts `answer`, optional `visibility`.
- Creates `verified_facts`.
- Creates `knowledge_sources` with text like:
  `Question: ...\n\nVerified answer: ...`
- Links source to the agent.
- Triggers `process-knowledge-source`.
- Sets query to `answered` only after source/link queueing succeeds.

`PATCH /api/flywheel/unanswered/[id]`
- Supports `dismiss`, `reopen`, and `mark_duplicate`.

`PATCH /api/flywheel/verified-facts/[id]`
- Supports editing draft/published answer text.
- If published answer changes, create a new processing job or reprocess the linked knowledge source.

Failure policy:
- If knowledge source is created but processing fails, keep the `verified_fact` and show `knowledge_sources.status = failed`.
- If source/link cannot be created, do not mark the query as `answered`.
- Expose a retry action in the UI for processing failures.

### 4. Widget Runtime Hook

Connect detection in the existing widget chat route.

Location:
- After `runAgentChat` returns.
- After user/assistant messages have been saved.
- Run in `after()` so the visitor stream is not blocked.

Adjustment:
- `insertWidgetMessages` should return inserted message IDs when the chat route needs them.
- Save `user_message_id` and `assistant_message_id` in `unanswered_queries`.

Detection MVP:
- Create a candidate if the assistant answer is empty, fallback-like, error-like, or explicitly uncertain.
- Create a candidate if `knowledgeMatches.length === 0` and the user question appears concrete/factual.
- Use a cheap background classifier to reduce false positives.
- The classifier may only create queue items, never publish knowledge.

Classifier output:
- `shouldCreate`
- `question`
- `reason`
- `confidence`

### 5. Dashboard UX Requirements

Route:
- Use `/questions` as the product-facing route and label.
- Keep `flywheel` as the internal feature/module name.

Navigation:
- Add `Questions` to the dashboard sidebar near `Leads` and `Analytics`.
- Navigation item must include an icon, label, active state, focus state, and optional open-count badge.

Page structure:
- Stable app shell with existing sidebar.
- Top row with title `Questions`, command/search input, and primary filters.
- Main work area split into:
  - Queue list/table of unanswered questions.
  - Detail drawer or right-side panel for the selected question.

First viewport requirement:
- A user should immediately see open questions, status counts, and the selected question context without scrolling on desktop.

Primary action:
- Use one visually dominant primary action in the detail panel: `Add verified answer` or `Publish to agent`.
- Avoid multiple competing black buttons in the same view.

### 6. Questions Queue UI

Use rows as the main scanning unit.

Each row should show:
- Question text, truncated gracefully.
- Agent name.
- Widget or page/source.
- Status badge.
- Confidence badge or score.
- Detection reason.
- Created time.
- Processing indicator if already answered.
- Overflow menu for secondary actions.

Recommended statuses:
- `Open`
- `In review`
- `Answered`
- `Dismissed`
- `Duplicate`
- `Processing`
- `Ready`
- `Failed`

Badge guidance:
- Status labels must work without color.
- Use pastel badges only for metadata and state, not decoration.
- Suggested mapping:
  - Open: neutral gray.
  - In review: pale lavender.
  - Answered/ready: pale green or blue.
  - Processing: pale blue.
  - Failed: pale red/peach.
  - Duplicate/dismissed: muted gray.

Queue controls:
- Search: question text, URL/referrer, agent name.
- Filters: status, agent, widget, confidence, date range.
- Sort: newest, oldest, highest confidence, lowest confidence.
- View options: show/hide dismissed and duplicates.
- Bulk actions can wait until after MVP unless volume is already high.

Row states:
- Hover reveals quick actions.
- Selected row has a subtle active background and stronger border.
- Focus ring is visible for keyboard navigation.
- Loading uses skeleton rows with the same height as loaded rows.
- Error state keeps the list area stable and offers retry.

### 7. Question Detail And Answer Flow

Selecting a row opens a detail panel.

Detail panel sections:
- Question.
- Agent/widget/source metadata.
- Assistant's previous answer.
- Conversation excerpt.
- Detection reason and confidence.
- Answer editor.
- Knowledge processing status after publish.
- Activity/history if available.

Answer editor:
- Use a focused text area with clear label: `Verified answer`.
- Show helper text only when useful: answer should be factual, reusable, and customer-approved.
- Include `visibility` as a small segmented control or select:
  - `Agent only`
  - `Public ready`
- Default to `Agent only`.

Actions:
- Primary: `Publish to agent`.
- Secondary: `Save draft` if drafts are implemented.
- Secondary/destructive: `Dismiss`.
- Overflow: `Mark duplicate`, `Reopen`, `Copy question`, `Open conversation`.

Publish confirmation:
- Do not use a blocking confirmation modal for normal publish.
- After publish, show an inline success state:
  - `Added to agent knowledge`
  - Processing status: `pending`, `processing`, `ready`, or `failed`
  - Link to the created knowledge source if there is an existing knowledge UI.

Failure recovery:
- If processing fails, show a compact failed state with `Retry processing`.
- If answer submission fails, keep the draft text in the editor.
- If permission fails, show a clear read-only state and hide publish controls.

Duplicate UX:
- Marking duplicate should require selecting or confirming the original question.
- Duplicate rows should link back to the original.
- The original should show a count of duplicates when available.

### 8. Empty, Loading, Error, And Permission States

Empty open queue:
- Message: `No open questions`
- Body: `New unanswered visitor questions will appear here after the agent needs help.`
- Optional secondary action: link to widget analytics or conversations.

No search results:
- Message: `No questions match these filters`
- Action: `Clear filters`.

Loading:
- Keep sidebar, topbar, filters, and toolbar visible.
- Use skeleton rows and a skeleton detail panel.
- Avoid layout shift between skeleton and loaded state.

Error:
- Keep the failed region in place.
- Explain what failed in plain language.
- Provide `Retry`.

Read-only permission:
- Users without agent edit permission can view questions but cannot publish, dismiss, duplicate, or reopen.
- Show disabled controls with accessible labels or hide unavailable actions consistently.

### 9. Visual And Component System

Follow the existing app design system first. If there is no stronger local pattern, use this direction:
- Neutral canvas.
- White work surfaces with low-contrast `1px` borders.
- Near-black primary text.
- Muted gray secondary text.
- Sparse pastel badges for state.
- Black filled primary button.
- 8px default radius for controls, rows, and badges.
- Soft shadow only for the detail drawer, selected/floating surfaces, or menus.

Reusable components to prefer:
- `SidebarNavItem`
- `TopBar`
- `CommandSearch`
- `FilterButton`
- `SortMenu`
- `StatusBadge`
- `QuestionRow`
- `QuestionDetailPanel`
- `AnswerEditor`
- `ProcessingStatus`
- `EmptyState`
- `SkeletonRow`

Interaction standards:
- Every control needs hover, focus, disabled, and loading states.
- Icon-only buttons need accessible labels and tooltips.
- Touch targets should be at least 40px high, 44px where practical.
- Text must not overlap or resize rows during loading/status changes.

### 10. Responsive Behavior

Desktop:
- Persistent sidebar.
- Queue plus detail panel can appear side by side.
- Metadata columns remain visible.

Tablet:
- Sidebar may narrow.
- Toolbar can wrap once.
- Less important row metadata can move into overflow.

Mobile:
- Sidebar becomes drawer or existing mobile nav.
- Topbar stacks title/search/filter.
- Queue rows become compact two-line cards.
- Detail panel opens as full-screen sheet or route-level detail view.
- Primary publish action remains visible near the editor.

### 11. Mini-Site Preparation, Not Build Yet

Do not build the mini-site in this MVP.

Keep the data ready:
- `verified_facts.visibility = public_ready` can be used later.
- Future mini-site reads `verified_facts` and renders FAQ/JSON-LD.
- Future agent page can use the same facts without another migration.

Later phase:
- `agent_sites`
- `/a/[slug]`
- `/a/[slug]/llms.txt`
- sitemap/robots
- JSON-LD from `verified_facts`

### 12. Recommended Split

Build in this order:

1. DB + helpers
   - Migrations, RLS, helper module, tests.

2. APIs + dashboard foundation
   - Query list, detail endpoint, answer flow, dismiss/duplicate/reopen.

3. Dashboard UI polish
   - Queue, filters, detail panel, answer editor, states, responsive layout.

4. Runtime detection
   - Widget hook, classifier, dedupe, integration tests.

This can live in one branch, but implementation should still follow the order above.

### 13. Test And Verification Plan

Automated:
- `npm run test`
- `npm run build`
- Supabase MCP `get_advisors security`
- Supabase MCP `get_advisors performance`

Backend scenarios:
- Agent misses a question -> `unanswered_queries` is created.
- Same question is repeated -> dedupe prevents multiple open items.
- Customer answers -> `verified_facts` is created.
- Customer answers -> `knowledge_sources` is created and linked to the agent.
- Edge Function processes -> source becomes `ready`, chunks exist.
- Next chat with same question finds a knowledge match.
- Another workspace cannot read or answer the query.
- Detection errors do not affect the widget stream.
- Knowledge processing failure is visible but does not destroy query/fact data.

UI scenarios:
- Open queue loads with skeletons and then stable rows.
- Empty queue state is clear.
- Search/filter/sort update the queue without breaking selection.
- Selecting a question opens the correct detail panel.
- Publishing keeps draft text if the request fails.
- Processing status updates after publish.
- Failed processing exposes retry.
- Read-only users cannot publish or mutate questions.
- Keyboard users can reach rows, filters, editor, and actions.
- Mobile layout does not truncate essential question text or hide the publish action.

Visual verification:
- Check desktop and mobile screenshots.
- Confirm row alignment, badge contrast, text truncation, focus rings, and loading-state dimensions.
- Confirm there are no decorative gradients/orbs, nested cards, or competing primary actions.

## Assumptions

- The flywheel loop ships before the mini-site.
- Human approval is mandatory before RAG is updated.
- First detection version should be conservative.
- `verified_facts` is the truth layer for future SEO/FAQ.
- Existing Edge Functions remain the RAG backbone.
- Supabase schema changes are local migrations first, not direct production changes.
