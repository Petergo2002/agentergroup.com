# PLAN: Analytics Workspace Simplification

Simplify the high-fidelity Analytics Workspace by removing secondary intelligence layers (right sidebar, intervention bar, inline matches) to focus on a clean, full-width chat experience.

## User Review Required

> [!IMPORTANT]
> **Layout Shift**: Removing the right sidebar will expand the Chat Transcript to occupy the full remaining width. This creates a more 'Cinematic' reading experience for long transcripts.

> [!WARNING]
> **Feature Removal**: The 'Intervene' and 'Send Action' capabilities will be removed from the UI as per the request. These features will no longer be visible in the Operational Console.

## Proposed Changes

### Frontend - Analytics Workspace

#### [MODIFY] [AnalyticsWorkspaceView.tsx](file:///Users/petergorgees/Dev/Agentergroup.com/src/components/analytics/AnalyticsWorkspaceView.tsx)
- **Remove Pane 3**: Delete the `<aside>` containing 'Lead Intelligence' and 'Knowledge Matches'.
- **Remove Intervention Bar**: Delete the absolute-positioned floating `div` at the bottom of the transcript.
- **Remove Inline Intelligence Matches**: Delete the `Intelligence Match` snippet card within the assistant message rendering logic.
- **Remove Intent Captured Badge**: Delete the orange floating badge showing 'Intent Captured'.
- **Clean Up Styles**: Adjust padding/margins in the main container to ensure the layout remains balanced and premium without the right-side constraints.

## Task Breakdown

### Phase 1: Cleanup & Removal
- [ ] Delete Pane 3 (Right Sidebar) and corresponding logic.
- [ ] Delete Floating Intervention Bar from `AnalyticsWorkspaceView`.
- [ ] Delete `Intelligence Match` and `Intent Captured` badges from `ConversationDetail`.

### Phase 2: Refinement & Layout
- [ ] Audit the `main` layout to ensure Pane 2 (Transcript) expands correctly.
- [ ] Adjust padding in the transcript area to account for the extra horizontal space.
- [ ] Verify that the header metrics remain properly aligned.

## Verification Plan

### Automated Tests
- Run `npm run lint` to ensure no orphaned variables or broken imports remain after deletions.

### Manual Verification
- Verify that the chat transcript now occupies the full width next to the left sidebar.
- Confirm that the "Operational Console" header strip (Live, Throughput) is still functional and visible.
- Ensure that clicking a session in the left feed correctly loads the simplified, clean chat view.
