# Lead Conversation Summaries

Last updated: 2026-09-11

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

### Caching and Dynamic Refresh

- **Dynamic Refresh on Transcript Change:** When a visitor continues the conversation after initial lead capture, background execution via `after()` in the public chat route observes that the transcript's SHA-256 `sourceHash` has changed. The generator re-runs in the background to incorporate the new messages into the summary so operators see the complete conversational context.
- **Zero-Cost Cache Hits:** If the transcript is unchanged (`sourceHash` matches the persisted hash), the existing `ready` summary is immediately returned without making a redundant model call or consuming message credits.
- **Manual Regeneration:** Operators can trigger manual regeneration using `POST /api/leads/:leadId/summary`. The route authenticates the user, resolves the active workspace, and passes that workspace id to the admin-backed generator before any summary is returned or changed.

## Storage and Security

- Migration `20260618120959_lead_conversation_ai_summaries.sql` creates one summary row per lead. Rows reference the workspace, lead, and widget session. Lead/session deletion cascades to the summary.
- Migration `20260911180000_optimize_widget_session_summary_triggers.sql` adds high-performance fast-paths to `private.refresh_dashboard_conversation_summary_from_session()`:
  - Turn-lock state transitions (`active_turn_request_id`) bypass summary refresh.
  - Heartbeat pings (`last_seen_at`) update `last_activity_at` via primary-key index update without lateral joins.
  - Periodic `pg_cron` inactivity sweeps update `status = 'completed'` without running full aggregation pipelines.
- RLS is enabled. Authenticated users receive read-only access when `private.is_workspace_member(workspace_id)` succeeds. Anonymous access is revoked. Writes are server-only through the service role, after route-level workspace authorization or from trusted post-response widget processing.
- The transcript is treated as untrusted input in the model prompt. Instructions found inside customer messages must not be followed, and generated claims must come from the captured lead or transcript.

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


## Leads are grouped by person

The leads inbox groups captures into the people who made them. A visitor who
comes back three times is one contact with three conversations, not three
leads — the flat list made returning prospects, the most valuable signal there
is, look like clutter.

Identity is matched on normalized email, falling back to normalized phone, and
a capture with neither stays its own row. Unidentified is not the same as
"the same person", so those never merge together.

**Phone normalization strips formatting but never guesses a country code.**
`0723220417` and `+46723220417` are probably the same Swedish number, but
inferring that requires assuming a country, and a wrong assumption shows one
visitor's conversations under another's name. A missed merge is cosmetic; a
false merge is a privacy problem.

The contact row shows merged details — the name from one capture, the phone
from another — so it can display information no single capture holds. A newer
blank never erases what an earlier capture recorded, and the extractor's
"Website Visitor" placeholder is treated as no name at all.

A returning contact shows its conversation count instead of a source badge: a
single "Contact Form" badge would be a lie on a contact whose other
conversations arrived through chat. Each capture carries its own source in the
expanded list.

Counts are reported as **contacts · conversations** in both the customer inbox
and the admin analytics, so the two screens never disagree about what a "lead"
is. Grouping is on by default, with a toggle back to the flat chronological
list.
