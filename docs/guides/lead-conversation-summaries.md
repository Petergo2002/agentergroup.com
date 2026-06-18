# Lead Conversation Summaries

Last updated: 2026-06-18

## Purpose

Widget leads can include a persisted AI summary of their conversation. The summary appears in the Leads detail/message view and the Analytics conversation detail view. It covers the customer need, collected details, intent level and reason, recommended next action, and missing information.

## Generation Flow

Summary generation runs with Next.js `after()` only after a lead and widget conversation exist. Public chat and lead-capture responses do not wait for the model call.

The generator:

1. loads the lead and its workspace through the linked widget;
2. loads up to the latest 80 user/assistant messages;
3. stores a source hash, message count, and latest message timestamp;
4. requests strict JSON-schema output from OpenRouter and validates it with Zod;
5. merges captured lead contact fields over model output; and
6. persists the result in `lead_conversation_summaries`.

Each model generation attempt consumes one workspace message credit. If the workspace has no remaining credits, the persisted summary moves to `failed`; manual regeneration returns the normal `MESSAGE_LIMIT_REACHED` response.

## States and Regeneration

- `generating`: a generation attempt is in progress. Attempts older than five minutes may be retried.
- `ready`: the transcript contained enough information to summarize the customer need.
- `insufficient`: no useful customer request was available yet. A structured fallback still shows known contact data and missing information.
- `failed`: generation did not complete. A previously successful summary is retained when available.

A ready summary is not regenerated on every new message. The API compares its stored message count with the current conversation, marks it stale in the UI, and lets an authorized user regenerate it. This avoids repeated model calls during active chats.

Manual regeneration uses `POST /api/leads/:leadId/summary`. The route authenticates the user, resolves the active workspace, and passes that workspace id to the admin-backed generator before any summary is returned or changed.

## Storage and Security

Migration `20260618120959_lead_conversation_ai_summaries.sql` creates one summary row per lead. Rows reference the workspace, lead, and widget session. Lead/session deletion cascades to the summary.

RLS is enabled. Authenticated users receive read-only access when `private.is_workspace_member(workspace_id)` succeeds. Anonymous access is revoked. Writes are server-only through the service role, after route-level workspace authorization or from trusted post-response widget processing.

The transcript is treated as untrusted input in the model prompt. Instructions found inside customer messages must not be followed, and generated claims must come from the captured lead or transcript.

## Relevant Files

- `src/lib/leads/conversation-summary.ts`: generation, validation, staleness, and persistence
- `src/app/api/leads/[leadId]/summary/route.ts`: authenticated manual regeneration
- `src/components/leads/LeadAiSummaryCard.tsx`: shared summary UI
- `src/app/api/leads/route.ts`: Leads data loading
- `src/lib/dashboard/analytics.ts`: Analytics conversation loading
- `tests/security/lead-conversation-summary.test.ts`: security and lifecycle regression checks

## Verification

When changing this feature, verify:

- public chat and lead capture return without waiting for summary generation;
- cross-workspace regeneration returns no lead data;
- RLS allows authenticated workspace reads and rejects anonymous reads;
- new transcript messages mark an existing summary stale;
- manual regeneration replaces stale content;
- insufficient and failed states render without hiding the transcript; and
- lead/session deletion cascades to the summary row.
