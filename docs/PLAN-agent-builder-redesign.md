# PLAN: Agent Builder Redesign (Blueprint Designer)

Transform the Agent Builder into a high-fidelity "Blueprint Designer" that matches the cinematic aesthetic of the new Analytics Workspace. This redesign focuses on the surrounding UI framework while strictly preserving the existing React Flow canvas logic.

## User Review Required

> [!IMPORTANT]
> **Canvas Policy**: I will strictly avoid modifying the core `@xyflow/react` logic. The focus is entirely on the **Header**, **Node Library**, **Properties Inspector**, and the visual styling of the **Custom Nodes**.

> [!NOTE]
> **Aesthetic Alignment**: I will use the "Pulse" brand palette (Orange/Purple/Grey) and established typography patterns from the Analytics redesign to ensure a cohesive "Agentergroup" experience.

## Proposed Changes

### Builder Surface - UI Framework

#### [MODIFY] [page.tsx](file:///Users/petergorgees/Dev/Agentergroup.com/src/app/%28app%29/agents/%5Bid%5D/builder/page.tsx)

**1. Header Redesign (Phase 1)**
- Replace the existing header with a "Blueprint Console" strip.
- **Left**: "Blueprint Designer" title + Agent Name in `font-headline`.
- **Center**: "Live Metrics" style chips showing node/edge counts and "Status: Draft".
- **Right**: A premium "Publish" button with intense orange-to-purple gradients and `shadow-2xl`.

**2. Node Library (Left Sidebar) (Phase 2)**
- Refine the floating sidebar with `backdrop-blur-2xl` and `bg-surface/70`.
- Redesign the "Node Chips" to be more minimalist, using consistent `rounded-2xl` shapes and high-fidelity icons.
- Add a subtle pulse animation to the "Active" node state.

**3. Properties Inspector (Right Sidebar) (Phase 3)**
- Apply a "Clinical Clean" layout to all input fields and textareas.
- Standardize all UI tokens: `rounded-2xl`, `border-outline-variant/10`, and `bg-surface-container-low`.
- Enhance the section headers with established typography: `text-[11px] font-bold uppercase tracking-[0.2em]`.

**4. Custom Node Styling (Phase 4)**
- Update the `AgentNode` component's visual container.
- Use `shadow-2xl` for depth and `ring-8 ring-primary/5` for selection states to give nodes a "floating" look.
- Refine the node headers with the minimalist status tags found in the Analytics feed.

## Task Breakdown

### Phase 1: Header Transformation
- [ ] Implement the "Blueprint Console" header layout.
- [ ] Add the "Live Metrics" indicators for builder status.
- [ ] Style the premium "Publish" and "Save" actions.

### Phase 2: Sidebar Rejuvenation
- [ ] Apply glassmorphism and blueprint-specific styling to the Node Library.
- [ ] Redesign the draggable Node Chips for a more "professional tool" feel.
- [ ] Implement the hidden/slide behavior with updated animations.

### Phase 3: Inspector Refinement
- [ ] Update the right sidebar (Inspector) with the new Agentergroup form variables.
- [ ] Audit all input fields for spacing and focus state consistency.
- [ ] Redesign the Knowledge and Tool selectors to be more minimalist.

### Phase 4: Final Polish
- [ ] Refine the visual container for `AgentNode` (Colors, Shadows, Borders).
- [ ] Update the React Flow `Controls` and `Background` overlays.
- [ ] Audit the entire workspace for "Vibe" consistency.

## Verification Plan

### Automated Tests
- `npm run lint`: Ensure no performance regressions or type errors in the redesigned components.

### Manual Verification
- Test node dragging and library functionality to ensure logic remained untouched.
- Verify the responsive behavior of the new sidebars.
- Confirm the "Blueprint Designer" feels like a premium, integrated part of the new system.
