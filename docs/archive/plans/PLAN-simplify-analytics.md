# Simplify Analytics Chat Sessions Visibility

## Goal
Remove the confusing "Active" / "Completed" / "All" filtering and the repetitive "Active" badges from the analytics chat sessions list, presenting a cleaner and more straightforward view of all conversations.

## User Context
The previous AI (Minimax) added a feature to separate "Active" and "Completed" sessions, which caused UI clutter and confusion. The presence of the word "Active" överallt (both as a filter and a green badge on every row) makes the interface noisy.

## Proposed Changes

### `src/components/analytics/AnalyticsWorkspaceView.tsx`

1. **Remove Status Filter Controls**
   - Delete the toggle group containing `["active", "completed", "all"]`.
   - Update the `DashboardAnalyticsAppliedFilters` default state for `sessionStatus` so that it fetches `"all"` by default behind the scenes, ensuring no sessions are hidden from the user.

2. **Remove "Active" Badge from Chat Rows**
   - In the `ConversationRow` component, remove the `bg-success/10 text-success` badge entirely.
   - Keep the "Lead Captured" (`hasLead`) badge if applicable, as it provides high-value business context. If no lead is captured, the row will simply display the time and agent info without the redundant "Active" pill.

3. **Simplify Header Text (Optional based on feedback)**
   - Clean up phrases like "Live Intelligence" or "Active Sessions" if they conflict with the fact that we are now showing *all* history, not just live ones.

## Edge Cases & Open Questions (Socratic Gate)

Innan vi går vidare med att implementera (via `/create` eller `/enhance`), fundera på dessa två frågor:
1. **Ska vi hämta ALLA samtal direkt?** Eftersom vi tar bort filtret, antar jag att vi ska ladda både pågående och avslutade samtal i en och samma vy?
2. **Ska "Lead Captured"-märket vara kvar?** Om ett samtal har fångat en kunds kontaktuppgifter är det ofta bra att visa upp, så jag tänkte lämna kvar just den badgen. Låter det bra?

## Verification Checklist
- [ ] Toggle-knapparna för "Active/Completed/All" är helt borttagna.
- [ ] Den gröna "Active"-badgen syns inte längre på varje konversationsrad.
- [ ] API-anropet laddar alla samtal (`sessionStatus="all"`) i bakgrunden utan att användaren behöver välja det.
- [ ] "Load More"-knappen fungerar fortfarande för att visa äldre konversationer.
