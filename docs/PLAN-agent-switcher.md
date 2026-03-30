# PLAN: Analytics Agent Switcher

Implement a high-fidelity, minimalist agent switcher in the Analytics Workspace to filter the Live Intelligence feed by specific AI agents or the global view.

## User Review Required

> [!IMPORTANT]
> **Placement**: The Agent Switcher will be placed as a horizontal, scrollable pill-list directly below the 'Live Intelligence' header in the left sidebar. This keeps the filter close to the content it affects while maintaining a minimalist aesthetic.

> [!NOTE]
> **Functional Impact**: Switching an agent will refresh the data feed in real-time, focusing the entire Operational Console on that specific agent's performance and active sessions.

## Proposed Changes

### Frontend - Analytics Workspace

#### [MODIFY] [AnalyticsWorkspaceView.tsx](file:///Users/petergorgees/Dev/Agentergroup.com/src/components/analytics/AnalyticsWorkspaceView.tsx)
- **New Component: `AgentFilterSelector`**: Create a minimalist horizontal scroll component that displays "All" vs specific agents from the `state.data.filters.agents` array. 
- **Style**: Use rounded pills with subtle hover effects and a 'Selected' state using the primary brand color (Pulse Purple/Orange).
- **Integrate Filter**: Update the `filters.agentId` state when a pill is clicked. The existing `useEffect` will automatically handle the API refetch.
- **Empty State**: Ensure that switching to an agent with no active sessions shows the existing high-fidelity empty state within the feed.

## Task Breakdown

### Phase 1: UI Foundation
- [ ] Implement the `AgentFilterSelector` component with high-fidelity pill styling.
- [ ] Add horizontal scroll support for workspaces with many agents.
- [ ] Style the 'Selected' vs 'Unselected' states (transition-heavy for premium feel).

### Phase 2: Logic Integration
- [ ] Hook the selector into the `filters` state in the main `AnalyticsWorkspaceView`.
- [ ] Ensure the "All Agents" option (null agentId) is clearly presented.
- [ ] Verify real-time refetching when the filter changes.

### Phase 3: Final Polish
- [ ] Audit the spacing between the 'Live Intelligence' header and the new switcher.
- [ ] Ensure the switcher is responsive and handles long agent names gracefully.

## Verification Plan

### Automated Tests
- Run `npm run lint` to ensure no orphaned variables or type mismatches.

### Manual Verification
- Test switching between 'All' and specific agents.
- Verify the 'Monitoring X active sessions' counter updates correctly based on the filter.
- Confirm that the UI remains "Clinical & Premium" without unnecessary clutter.
