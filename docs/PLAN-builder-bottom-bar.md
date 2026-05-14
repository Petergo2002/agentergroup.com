# Replace Agent Builder Side Node Library with Bottom Toolbar

## Goal Description
The current Node Library on the left side of the agent builder page takes up unnecessary screen real estate. The goal is to remove this left-side panel and replace it with a sleek, centered bottom bar featuring an "Add" button (with a '+' icon). Clicking this button will reveal a stylized menu/list of available nodes (Connections, Knowledge, Agent Core, Trigger, End Chat) that can be added to the canvas.

## User Review Required
> [!IMPORTANT]
> The bottom bar will be floating at the bottom center of the React Flow canvas. Please confirm if you want a simple dropdown menu above the '+' button, or a horizontal pill-shaped toolbar that expands when hovered/clicked.

## Open Questions
1. **Menu Behavior**: Should the new nodes list open as a pop-up menu when clicking '+', or should the bottom bar expand horizontally to reveal the icons?
2. **Icons vs Text**: In the new bottom menu, do you want just the icons with tooltips, or full text labels like the current sidebar has?
3. **Trigger Behavior**: Is it okay if the new menu uses the exact same `handleAdd...Node` logic under the hood without changing the node behavior itself?

## Proposed Changes

### Builder Page Component

#### [MODIFY] src/app/(app)/agents/[id]/builder/page.tsx
- **Remove** the `isNodeLibraryOpen` state and the entire `<aside>` element rendering the left sidebar.
- **Add** a new state `isAddMenuOpen` (boolean).
- **Add** a floating bottom-center `<div>` inside the canvas area (using `absolute bottom-6 left-1/2 -translate-x-1/2 z-50`).
- **Implement** the '+' Add button with a premium, vibrant aesthetic (e.g., primary color pill with shadow).
- **Implement** a popover/menu that renders the `nodeLibraryItems` in a refined list above the button when `isAddMenuOpen` is true.

## Verification Plan

### Manual Verification
- Open the builder page for any agent.
- Verify the left sidebar is completely gone and the canvas takes full width.
- Verify a floating "Add" button exists at the bottom center.
- Click the "Add" button and ensure the node library list opens.
- Click each item in the list (Trigger, Knowledge, Agent Core, Connected Tools, End Chat) and verify they are successfully added to the canvas.
- Verify disabled states (e.g. if Trigger is already added, it shows as added/locked).
