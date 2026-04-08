# Agent Picker UI Polish

## Goal Description
Enhance the layout and styling of the agent chooser (picker) screen in the widget to look cleaner and more premium. Address the harsh top gradient in the picker view and redesign the agent cards to stack vertically with descriptions if there is more than 1 agent.

## Task Breakdown
1. **Header Layout Sync (`HomeTab.tsx` / `Widget.tsx`)**
   - Ensure the hero gradient overlay behaves smoothly.
   - Adjust spacing and alignment in the agent picker view so it feels as native and non-overlayed as the individual agent chat header.

2. **Agent Card Stacking Layout (`HomeTab.tsx`)**
   - Reinstate `agent.description` **only** if `length > 1`.
   - Update layout container to stack agents vertically block-by-block.
   - Ensure dynamic flex or grid sizing allows them to fit the page bounds (add simple inner scroll container handling to guarantee fit regardless of agent count).

## Open Questions (Socratic Gate)
- **Constraint Handling**: When stacking 4+ cards vertically, should the list container be scrollable within the widget, or should all cards forcefully shrink with truncated descriptions?
- **Single Agent Mode**: If exactly 1 agent exists, it will omit the description. Should it still be a large clickable block, or auto-route?

## Verification Checklist
- [ ] Agent descriptions appear when >= 2 agents.
- [ ] Agent picker layout fits vertically (under each other).
- [ ] Header gradient looks soft, consistent with regular views without cutoff lines.
