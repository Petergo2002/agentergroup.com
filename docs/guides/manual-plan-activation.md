# Manual Plan Activation for the Managed Pilot

## Current mode

Agentergroup currently runs in **managed pilot mode**:

- customer-facing plan selection is hidden
- the Billing settings navigation item is hidden
- upgrade prompts do not link customers to Stripe
- Stripe checkout, extra-credit checkout, portal, and invoice endpoints return `404`
- plan limits and extra message credits are assigned by an internal administrator
- existing Stripe implementation remains in the codebase for future reactivation

The mode is controlled by:

```env
NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED
```

It is disabled by default. Only the exact value `true` enables self-serve
billing surfaces.

The shared source of truth is:

- `src/lib/billing-mode.ts`

## New account flow

1. A user signs up and a workspace is created with
   `workspaces.onboarding_completed = false`.
2. The owner is redirected to `/onboarding`.
3. The onboarding page displays a **Workspace activation pending** screen. It
   does not show plan prices or request payment details.
4. The screen refreshes its server state every eight seconds and also provides
   a manual **Check activation** button.
5. The workspace appears immediately in the internal Admin overview with a
   **Pending activation** badge.
6. An internal administrator opens `/admin/workspaces/[id]` and selects
   **Activate Free**, **Activate Starter**, or **Activate Premium**.
7. `PATCH /api/admin/workspaces/[id]/plan` first writes the selected plan and
   its limits to `workspace_subscriptions`, then sets
   `workspaces.onboarding_completed = true`.
8. The next automatic refresh redirects the owner to `/dashboard`.

Plan assignment is therefore the approval action. No separate activation
button is required.

## Admin operations during the pilot

### Assign or change a plan

Open:

```text
/admin/workspaces/[workspace-id]
```

Use the **Plan & Access** panel. Pending workspaces can be activated on any
plan, including Free and Trial. Active workspaces can be moved between plans
using the same control.

Every plan change opens a confirmation first. It is not a generic "are you
sure" — it lists what the change actually does to that workspace: the limits
before and after, whether usage carries over or is wiped, whether the trial
deadline is set or cleared, and whether the workspace is already over the new
limits (for example "this workspace has 7 agents but Starter allows 3"). A
change that removes access the customer is using right now — integrations
switching off, or usage already past the new ceiling — is marked destructive
and its confirm button turns red.

The panel also shows when the current allowance next resets, or how many days
a trial has left.

### See what a workspace has spent

The **Message usage** card on the same page shows messages remaining, a meter
of the allowance consumed, and when it resets. State is a reserved
good → warning → serious → critical scale stepping at 75%, 90% and 100%, and
every state carries an icon and a word — the colour is never the only signal.

Two cases it handles explicitly, because both are reachable:

- **Usage past the ceiling.** A downgrade can leave a workspace over its new
  limit. The meter caps at 100% rather than overflowing, the remainder shows 0
  rather than a negative, and a note states how far over they are.
- **A zero limit.** Treated as "no allowance" and shown as critical, rather
  than dividing by zero into an empty meter that looks healthy.

The admin plan endpoint does not call Stripe. It applies the limits defined in
`src/lib/plan-limits.ts`.

### Grant a 30-day trial

**Activate Trial** gives the workspace Starter's capabilities — 500 messages,
3 agents, integrations enabled — on a 30-day clock. The panel shows the days
remaining once the trial is running.

Two things behave differently from the other tiers:

- **Usage starts at zero.** Every other plan change preserves `messages_used`;
  a trial is a fresh grant, so it resets. The 500 messages cover the whole 30
  days, not 500 per month.
- **It ends by itself.** `workspace_subscriptions.trial_ends_at` is set 30 days
  out and `increment_workspace_message_usage` refuses messages past that date.
  There is no scheduled job to fail, and nothing to remember to switch off.

When the trial ends the workspace stops sending and the owner sees the ordinary
message-limit error. **Assign a paid plan to restore access** — that clears
`trial_ends_at` and applies the new limits. Re-granting Trial starts another
full 30 days from zero, so only do that deliberately.

A trial row whose `trial_ends_at` is null is treated as expired, not as
unlimited. A time-boxed grant fails closed.

### Grant extra message credits

Use the existing **Extra Credits** admin control on the same workspace page.
This increases `workspace_subscriptions.messages_limit` without resetting
`messages_used` and without contacting Stripe.

## Customer-facing billing surfaces hidden in pilot mode

- Settings → Billing navigation
- sidebar Upgrade button
- billing plans, payment method, invoices, and credit purchase page
- workspace/widget limit upgrade links
- Stripe plan checkout
- Stripe extra-credit checkout
- Stripe customer portal
- Stripe invoice retrieval

Direct navigation to `/settings/billing` redirects to `/settings`.

## Re-enabling self-serve billing later

1. Verify all Stripe environment variables and webhook configuration described
   in `docs/runbooks/production-readiness.md`.
2. Set:

   ```env
   NEXT_PUBLIC_SELF_SERVE_BILLING_ENABLED=true
   ```

3. Redeploy the application. This restores the existing customer Billing page,
   upgrade links, and Stripe billing endpoints.
4. Decide whether new accounts should remain manually approved or return to
   self-serve plan selection.
5. To restore self-serve plan selection during onboarding, replace the managed
   waiting content in `src/app/onboarding/OnboardingContent.tsx` with the plan
   picker flow that calls `/api/billing/checkout` and
   `completeOnboarding()` for Free accounts.
6. Run the Stripe checkout, webhook, portal, invoice, cancellation, and
   extra-credit verification checklist before enabling it in production.

Do not set the flag to `true` until Stripe price IDs and webhook processing have
been verified in the target environment.
