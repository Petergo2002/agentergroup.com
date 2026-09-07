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

Detection is deterministic. There is no paid or remote classifier in the current implementation.

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
