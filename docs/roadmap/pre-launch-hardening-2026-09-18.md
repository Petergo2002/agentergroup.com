# Pre-Launch Hardening — 18 September 2026

**Slug:** `pre-launch-hardening-2026-09-18`
**Status: COMPLETE — merged 18 September 2026.**
Retained as the implementation record. Living behaviour belongs in the linked
documents; this board is history, not a status report.

---

## 1. Overview & Objective

An external review of `449540d` raised six P1 findings and a set of P2s ahead of
onboarding the first pilot customers. Each claim was verified against the code
before any of it was acted on; all six reproduced. This round closes the ones
that matter for a managed chat-and-lead pilot and deliberately leaves the rest
gated or documented.

The findings share one shape: **something does not happen, and nothing says so.**
That is the through-line worth remembering — none of these surfaced as an error
to a visitor, an operator, or a test.

Two of the six were sharper than reported, and one was reported more broadly
than the code justified:

- **Multi-call dispatch was deterministic, not probabilistic.** It did not
  require the model to request parallel calls; the calendar wrapper manufactured
  the second call itself.
- **The billing reset did not merely "sometimes" fail.** For a live Stripe
  subscription it could never fire again.
- **Membership revocation was described as a cross-instance staleness issue.**
  In fact nothing invalidated the cache on removal at all.

---

## 2. What Shipped

### Every requested tool call now runs

`@composio/core` 0.10.0's `OpenAIProvider.handleToolCalls` iterates
`chatCompletion.choices` but indexes `tool_calls[0]` within each one. Since the
runtime puts all external calls of a turn into a single choice, only the first
ever executed.

The severity came from a second-order effect: `applyGoogleCalendarSelectionToCompletion`
`flatMap`s a single requested booking into two calls when `includePrimaryCalendar`
is enabled, so the `_primary` mirror was dropped on **every** such booking.

`dispatchToolCalls()` (`src/lib/composio-dispatch.ts`) replaces the SDK helper
and returns one result per call. Three related corrections came with it:

- Tool results are rebuilt from the calls the model **requested**, not from
  whatever came back, so `<id>_primary` companions fold into their parent
  instead of appearing as result ids the assistant message never contained.
- A failing call no longer aborts the turn; it returns its own error result and
  raises `hadToolFailure`.
- Session recreation retries **only the failed call**. The previous code replayed
  the entire batch, which would repeat the side effects of calls that had already
  succeeded.

→ **[Composio Integrations, Pitfall 5](../guides/composio-integrations.md)** —
read before touching this path.

### An interrupted model stream is no longer a completed answer

`streamOpenRouterResponse` ended its read loop on EOF exactly as it did on
`[DONE]`, and `runAgentChat` threw only on `finish_reason: "error"`. A reply cut
off mid-sentence was therefore streamed to the visitor, persisted as normal, and
counted as a success.

The parser now requires a real terminal state — `[DONE]` or a finish reason —
before returning. A bare EOF throws.

### A renewal resets the message allowance

`apply_workspace_subscription_event` advanced `billing_cycle_start/end` but never
touched `messages_used`, while the reset inside `increment_workspace_message_usage`
only fires once the stored cycle end is already in the past. A renewal webhook
always lands before the customer's next message, so the cycle end was replaced
with a future date and **the reset never fired again** — a paying customer kept
last month's exhausted allowance indefinitely.

Migration `20260918120000_reset_usage_on_billing_period_advance.sql` resets usage
in the same statement that advances the period, guarded by
`p_period_start > billing_cycle_start` so replays and same-period plan changes
never reset twice.

This mattered regardless of the self-serve billing flag: only
`/api/billing/{checkout,portal,invoices,extra-credits}` are gated by
`SELF_SERVE_BILLING_ENABLED`. The **webhook route is not**, so any
Stripe-linked subscription was affected.

### Raw debug traces no longer persist on the public visitor path

The runtime already redacts what it persists (`buildPersistedDebugTrace`), and
the widget route strips it again via `buildPersistedAssistantMetadata` — then
spread the raw `result.debugTrace` back in, defeating both layers and retaining
tool arguments and result excerpts on the one route anonymous visitors reach.
The three other call sites (`agents/[id]/chat`, `assistants/[id]/chat`, and the
automation executor) were already correct.

### Revoked members lose cached access immediately

`DELETE /api/workspaces/[id]/members/[memberId]` never called
`invalidateWorkspaceContextCache`, so a removed member kept working access for
the full 30-second TTL — and service-role reads such as lead listing trust that
cached context.

**This narrows the window; it does not close it.** The cache is process-local, so
other warm instances can still serve stale membership for up to 30 seconds.
Closing it properly means not caching authorization for service-role-backed
reads, which is tracked as an open finding rather than bundled in here.

### A timed-out tool call no longer invites a retry

`withToolExecutionTimeout` stops waiting but cannot cancel: the provider SDK
takes no abort signal, so the operation may still be running — and may already
have succeeded. The tool message told the model to "offer to try again", which
is how one booking becomes two. It now states the outcome is unconfirmed and
instructs the model not to repeat the action.

This is a mitigation, not a fix. See the open findings below.

### Document uploads are off for launch

`WIDGET_DOCUMENT_UPLOAD_ENABLED` (default `false`) rejects PDF and plain-text
uploads at `inspectWidgetAttachment`.

**Images are unaffected and still work.** The split is real: an image is passed
to the model as an `image_url` part and is readable on arrival, whereas a PDF
reaches the model only as `[Attached File: name (url)]` text. Answering from a
document therefore depends entirely on the knowledge-indexing pass, which the
upload route invokes **without awaiting** (`void ...functions.invoke(...)`) — its
result ignored, its rejection uncatchable by the surrounding `try/catch`. A
visitor could upload and ask before any of it was searchable, and a failed
invocation left the source `pending` with nothing to explain the silence.

Re-enable once indexing reports pending/ready/error states honestly.

---

## 3. Deliberately Not Fixed

| Finding | Decision |
| --- | --- |
| **Self-serve checkout can create a second subscription** | `/api/billing/checkout` calls Stripe with `mode: 'subscription'` and rejects only an identical plan — it never checks the existing `stripe_subscription_id`. Unreachable while `SELF_SERVE_BILLING_ENABLED` is false. **Fix before enabling self-serve billing**, not before the pilot. |
| **No durable idempotency for external writes** | A proper operations ledger with idempotency keys and reconciliation is architecture, not a pre-launch patch. At pilot volume, the prompt change above plus a daily calendar check is the proportionate control. |
| **Knowledge retrieval outages look like "no match"** | Carried forward; already tracked in [Production Readiness](../runbooks/production-readiness.md#known-open-findings-carried-forward-from-archived-audits). |
| **Lead-notification failures are silent** | `deliver()` returns `success: false` rather than throwing, and the lead route discards the result. The lead is still saved, so the dashboard is the source of truth. Carried forward. |
| **Automation executor crash recovery** | Automation is outside the Milo pilot. Carried forward. |

---

## 4. Verification

- 424/424 tests passing (402 before this round, 22 added), 0 ESLint warnings,
  0 TypeScript errors, clean Next.js production build, clean widget build.
- The migration was applied to the linked project and verified in place: the
  deployed function now carries the reset, remains `security invoker`, and
  executes only for `service_role` (`postgres=X/postgres, service_role=X/postgres`).
  The reset expression was checked against renewal / replay / mid-period-change /
  first-event inputs. Supabase security advisors reported nothing new.
- The pre-existing deployed function was read from production **before** the
  change, confirming the defect was live rather than only present in the
  migration file.

New behavioural tests:

| File | Covers |
| --- | --- |
| `tests/security/tool-call-dispatch.test.ts` | Multi-call execution, `_primary` companions, partial failure, retry-only-the-failed-call |
| `tests/security/openrouter-stream-termination.test.ts` | EOF, empty stream, `[DONE]`, finish reason, provider error, truncated tool JSON |
| `tests/security/document-upload-disabled.test.ts` | Images accepted, documents rejected, flag restores documents |
| `tests/security/pre-launch-hardening.test.ts` | Usage-reset SQL, debug-trace removal, revocation invalidation, timeout wording |

**Not verified here:** real Composio provider semantics (the dispatch tests use a
fake executor), a live Stripe renewal against an exhausted quota, and
multi-instance revocation behaviour.

---

## 5. Still Open Before Unattended Use

1. Confirm a real error reaches the operator (no Sentry event was sent during
   this round).
2. Confirm customer data can be restored, not merely backed up.
3. Re-run a real booking end to end after deploy — the dispatch path changed.
4. Close the multi-instance revocation window if service-role reads keep
   trusting cached membership.
