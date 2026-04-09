# Deployment Tab Layout Plan

## 1. Context & Problem Statement
The current deployment tab uses a two-column grid (`md:grid-cols-2`) for "Embed Snippet" and "Hosted Endpoint". This layout is problematic because:
1. The right side of the screen is obstructed by the floating "Live Widget Preview" container.
2. The cards feel compressed horizontally, causing UI elements (like toggle switches and buttons) to wrap awkwardly or look disproportionate.
3. The "Security & Domain Access" section sits below in a full-width layout, creating an inconsistent visual flow.

## 2. Proposed Layout Architecture (Single Column / Max-Width)
To make the design make more sense while preserving the premium aesthetic, we will shift from a side-by-side grid to a clean, stacked vertical layout with a constrained maximum width (e.g., `max-w-3xl` or `max-w-4xl`).

### Section A: Embed Snippet (Top)
- **Format:** Full-width card (constrained by max-w).
- **Structure:** Easy to read top-to-bottom. Label and "Copy" button on top, code block below with plenty of breathing room.

### Section B: Hosted Endpoint (Middle)
- **Format:** Full-width card below the Embed Snippet.
- **Structure:** 
  - Header: Label, "Open" and "Copy Link" buttons.
  - Body: The hosted URL clearly displayed.
  - Footer: Status toggle (On/Off) with description text.
  - Since it has full width, nothing will wrap awkwardly.

### Section C: Security & Domain Access (Bottom)
- **Format:** Integrated seamlessly as the 3rd card in the stack, or as a visually distinct section below the `Access & Connectivity` cards.
- **Structure:** The input field and "Add Domain" button will have comfortable horizontal space. Authorized domains will display in an elegant grid or list.

## 3. Design Tokens & Aesthetics
- Keep the existing `bg-surface-container-low` and `bg-surface-container-lowest` layered look.
- Keep the rounded corners (`rounded-[2.5rem]`) and subtle borders (`border-outline-variant/10`).
- Use `space-y-6` or `space-y-8` to give generous vertical padding between cards.
- Ensure the layout naturally avoids the "Live Widget Preview" floating on the right by constraining the main content width.

## 4. Execution Steps (For Phase 4: Implementation)
1. Remove `md:grid-cols-2` from the `Access & Connectivity` container.
2. Wrap the main content sections in a `<div className="max-w-4xl space-y-12">` container.
3. Adjust the internal flexbox layouts of the "Embed Snippet" and "Hosted Endpoint" cards to take advantage of the wider column.
4. Verify responsiveness (mobile stacking vs desktop max-width).

## 5. Verification
- Confirm that the "Live Widget Preview" no longer overlaps the "Hosted Endpoint" card on standard desktop sizes.
- Confirm that no internal elements inside the cards are squished or forced to wrap unexpectedly.
