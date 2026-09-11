# Questions / Data Flywheel

Last updated: 2026-08-12

Improve Milo is the Milo-mode operator surface for unanswered Website Chat questions. It turns real visitor misses into verified Milo Knowledge without adding another model call to the chat path. The route remains `/questions`, and classic workspaces retain generic Questions/agent language.

## Current Flow

1. A visitor sends a message to `POST /api/public/widgets/[widgetPublicKey]/chat`.
2. The widget route persists the user message, runs `runAgentChat`, streams the assistant answer, and persists the assistant message.
3. After persistence, the route schedules `scheduleFlywheelCapture()` with `after()`. This keeps visitor streaming fast and gives the capture job the durable user and assistant message ids.
4. Preview widget chats return before capture. Preview traffic must not create Questions rows.
5. `detectUnansweredQueryCandidate()` in `src/lib/flywheel/detection.ts` decides whether the user message is a concrete missed question.
6. `createUnansweredQueryCandidate()` in `src/lib/flywheel/server.ts` inserts or updates an `unanswered_queries` row through the admin Supabase client.
7. The authenticated `/questions` page lists rows from `GET /api/flywheel/unanswered`; Milo mode presents this as Improve Milo and removes redundant agent/widget filters.
8. When an operator publishes an answer, `POST /api/flywheel/unanswered/[id]/answer` creates a `verified_facts` row, creates a text `knowledge_sources` row, places it in the agent's auto-managed verified answers folder, queues `process-knowledge-source`, and marks the question `answered`.

## Detection Rules

Detection has two layers. The model reports its own knowledge gaps; prose pattern matching remains as a fallback.

### Layer 1 — the model reports the gap (primary)

`src/lib/runtime/agent-chat.ts` exposes an internal tool, `flag_missing_knowledge`, alongside `suggest_end_chat`. The model calls it during the same completion whenever it cannot fully answer from verified knowledge — including partial answers, deflections to a human, and offers to take contact details. It costs no extra model call.

The tool takes the visitor's question **rewritten as a standalone question**, so follow-ups are usable on their own: `"what year?"` is stored as `"What year did Agenter Group release its SaaS platform?"`.

A model report sets `source: "model_tool"` at confidence 0.95 and bypasses the "is this concrete enough" gate, because the model has already made that judgement. It is ignored if it arrives without a usable question, so a bare greeting is never captured.

This layer exists because the patterns below are phrasing-bound. Two failure modes they cannot cover:

- questions with no `?` and no WH word, whose topic is not in the keyword list (`"i want to know the networth"`)
- warm deflections, which the Milo personality explicitly instructs (`"Let me get someone from the team to send you exact pricing — what's your email?"`)

### Layer 2 — prose patterns (fallback)

Used when the model does not call the tool. Deterministic, no remote classifier.

`src/lib/flywheel/detection.ts` captures:

- direct factual questions with `?`
- English and Swedish WH questions
- English and Swedish auxiliary yes/no questions without punctuation, such as `Can I pay by invoice`, `Do you integrate with Slack`, and `Kan jag betala med faktura`
- concrete business topics such as pricing, booking, invoice/payment, integrations, support, compatibility, GDPR, policies, shipping, returns, and contact details
- assistant answers that state the fact is missing, uncertain, not provided, not mentioned, not visible, or not locatable
- runtime failures and empty assistant answers for otherwise concrete questions
- concrete questions with zero knowledge matches, at lower confidence

Detection ignores conversational noise such as greetings, thanks, `Can you help?`, and `Are you there?`.

Mixed visitor messages are cleaned before storage. For example, `Hi, can I pay by invoice thanks` is stored as `can I pay by invoice`.

### Comparing the two layers

Every capture records both verdicts in `unanswered_queries.metadata`:

- `detectionSource` — which signal fired (`model_tool`, `fallback_pattern`, `no_knowledge_match`, `runtime_error`, `empty_answer`)
- `patternWouldCreate` — whether the legacy patterns would have caught it alone

Both detectors therefore run on all live traffic without a feature flag or a divergent code path. To measure how much the model layer adds:

```sql
select metadata->>'detectionSource' as source,
       metadata->>'patternWouldCreate' as pattern_alone,
       count(*)
from public.unanswered_queries
group by 1, 2 order by 3 desc;
```

Rows with `source = model_tool` and `pattern_alone = false` are captures the old detector would have missed entirely.

## Database Model

`unanswered_queries` stores the queue item:

- workspace, widget, widget agent, agent, and widget session ids
- user and assistant message ids when available
- cleaned question text
- assistant answer and context excerpt
- detection reason, confidence, status, duplicate target, dedupe hash, metadata
- `created_at`, `updated_at`, and `resolved_at`

`verified_facts` stores operator-approved answers:

- workspace and agent ids
- optional source `unanswered_query_id`
- answer visibility: `agent_only` or `public_ready`
- linked `knowledge_source_id`
- publication and retirement timestamps

Verified-answer knowledge sources are grouped into one auto-managed Knowledge folder per agent:

- folder name: `Verified answers - {Agent name}`
- folder metadata: `{ system: "flywheel", purpose: "verified_answers", agentId }`
- the folder is attached to the agent through `agent_knowledge_folders`
- each verified-answer source is linked through `knowledge_folder_sources`

RLS stays workspace scoped. Public widget capture uses the service/admin client from the server route; anonymous clients do not get direct table access.

Important indexes:

- `unanswered_queries_open_dedupe_idx` keeps one open exact duplicate per workspace + agent + dedupe hash.
- `unanswered_queries_workspace_status_updated_idx` supports latest-activity queue loading by workspace/status.
- FK indexes from `20260702202606_flywheel_fk_indexes.sql` cover widget, widget-agent, message, and creator lookups.

## Dedupe And Repeat Misses

Dedupe is workspace + agent scoped and only suppresses open duplicates.

Exact duplicates use the normalized dedupe hash. Near duplicates use token overlap after common filler words and simple plural aliases are removed.

When an open duplicate is seen again, the existing row is updated instead of inserting a second row. The update refreshes:

- latest widget/session/message references
- assistant answer and context excerpt
- detection reason
- max confidence
- `metadata.occurrenceCount`
- `metadata.lastCapturedAt`
- `updated_at`

The open queue sorts by latest activity, so repeated unresolved misses resurface.

## Improve Milo / Questions UI

The route is `/questions`.

In Milo mode:

- the sidebar label is Improve Milo
- copy refers to Milo rather than a generic agent
- publishing a verified answer is presented as teaching Milo
- the primary agent and widget are implicit, so their inventory filters are hidden

The APIs and stored foreign keys remain generic so classic workspaces and historical records stay compatible.

The server page loads the initial open queue and status counts. The client then fetches:

- selected status, agent, and widget through `/api/flywheel/unanswered?status=...`
- server-side counts from the same response
- detail data through `/api/flywheel/unanswered/[id]`
- duplicate candidates through a separate agent-scoped all-status request when the duplicate action is available

This is intentional. The UI must not fetch a capped mixed-status result set and then filter client-side, because that can hide open questions when many answered or dismissed rows exist.

Available operator actions:

- publish or update a verified answer
- dismiss an open question
- reopen dismissed or duplicate questions without verified answers
- mark an open question as a duplicate of an open or answered question for the same agent
- retry knowledge processing for a linked verified answer

## API Contract

`GET /api/flywheel/unanswered`

- Authenticated.
- Uses the active workspace.
- Query params: `status`, `agentId`, `widgetId`, `limit`.
- `status` can be `open`, `answered`, `dismissed`, `duplicate`, or `all`.
- Default status is `open`.
- Limit is clamped to `1..200`.
- Returns `{ questions, counts }`.

`GET /api/flywheel/unanswered/[id]`

- Authenticated.
- Returns one hydrated question plus up to 40 session messages.

`POST /api/flywheel/unanswered/[id]/answer`

- Authenticated and agent-edit permission required.
- Body: `answer`, optional `visibility`.
- Creates or links the verified knowledge path, places the source in the agent's verified-answer folder, and marks the question answered only after source/link queueing succeeds.

`PATCH /api/flywheel/unanswered/[id]`

- Authenticated and agent-edit permission required.
- Body actions: `dismiss`, `reopen`, `mark_duplicate`.

`PATCH /api/flywheel/verified-facts/[id]`

- Authenticated and agent-edit permission required.
- Updates answer text or visibility, or retries processing.

## Verification Checklist

Run these after changes to detection, queue APIs, migrations, or the Questions tab:

```bash
npm run test
npm run build
```

Use realistic cases for detection regressions:

- `Can I pay by invoice`
- `Do you integrate with Slack`
- `Is your product GDPR compliant`
- `Kan jag betala med faktura`
- `Can you help?`
- `Are you there?`

For database changes, verify the Supabase migration history and confirm the operational index exists:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'unanswered_queries'
  and indexname = 'unanswered_queries_workspace_status_updated_idx';
```
