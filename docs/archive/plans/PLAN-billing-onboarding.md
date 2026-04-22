# Billing Onboarding Plan

## Overview
When a new user signs up, they should be presented with a quick onboarding screen to choose their subscription plan (Free, Starter, Premium) before they enter the main dashboard. This creates a smoother user experience and encourages plan selection right away.

## User Review Required
> [!IMPORTANT]
> - **Mandatory Onboarding:** Should this onboarding page be strictly mandatory? (i.e., if they try to manually type `/dashboard` in the URL without completing it, should they be forced back to `/onboarding`?) 
> - **Database Flag:** Right now, new users get a default "Free" plan. Do we want a database flag like `onboarding_completed` in the `workspaces` table to enforce this, or is it enough to just change the post-signup redirect to `/onboarding`?

## Open Questions
> [!WARNING]
> - **Invited Members:** How should we handle users who are invited to an existing workspace? They shouldn't see the billing onboarding because the workspace already has a billing plan. We will need to make sure we don't show the onboarding screen to invited members.

## Project Type
WEB

## Success Criteria
- New signups are routed to `/onboarding` instead of `/dashboard`.
- They see a clean, distraction-free UI with the 3 plans (Free, Starter, Premium).
- Selecting "Free" redirects them directly to `/dashboard`.
- Selecting "Starter" or "Premium" redirects them to Stripe Checkout.
- After a successful checkout, they land on `/dashboard`.

## Tech Stack
- Next.js App Router
- TailwindCSS (Clean, white aesthetic, no golden gradients)
- Stripe Checkout
- Supabase (for checking user/workspace state)

## File Structure
- `src/app/onboarding/page.tsx` (New onboarding UI)
- `src/app/onboarding/layout.tsx` (Minimal layout, no sidebar to keep focus on plans)
- `src/app/login/actions.ts` (Update redirects to point to `/onboarding`)
- `src/app/(app)/layout.tsx` (Optional: Layout check to enforce onboarding)

## Task Breakdown
- **Task 1: Create the `/onboarding` route and UI** (Agent: `frontend-specialist`, Skill: `frontend-design`)
  - Create `src/app/onboarding/page.tsx` displaying the three pricing tiers.
  - Reuse the billing logic from `settings/billing/page.tsx` to handle standard checkout flows.
  - Implement a clean "Continue with Free" button that just routes to `/dashboard`.
  - INPUT: None → OUTPUT: Working UI page → VERIFY: Visual check in browser.
  
- **Task 2: Update Authentication Redirects** (Agent: `backend-specialist`, Skill: `api-patterns`)
  - Update `src/app/login/actions.ts` so `signUp` redirects to `/onboarding` instead of `/dashboard`.
  - Update `emailRedirectTo` in Supabase auth options to point to `/onboarding`.
  - INPUT: Sign up action → OUTPUT: Modified redirects → VERIFY: Signing up sends you to onboarding.
  
- **Task 3: Handle Invited Users & Enforce State** (Agent: `backend-specialist`, Skill: `database-design`)
  - Add logic to ensure users joining via an invite link bypass the billing onboarding, as they are joining an already-billed workspace.
  - INPUT: Invite link flow → OUTPUT: Skip onboarding → VERIFY: Invited users go straight to dashboard.

## ✅ PHASE X: Verification
- [ ] Lint & Type Check (`npm run lint && npx tsc --noEmit`)
- [ ] Manual Test: Sign up flow redirects to `/onboarding`.
- [ ] Manual Test: Selecting the Free plan goes to `/dashboard`.
- [ ] Manual Test: Selecting a Paid plan goes to Stripe Checkout → `/dashboard`.
- [ ] Manual Test: Invited members bypass onboarding successfully.
