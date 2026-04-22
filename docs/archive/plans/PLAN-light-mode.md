# /plan - Light Mode Support

Implement a full-scale light mode for the Agentergroup platform, ensuring the builder and all sub-sections are fully compatible with a premium light aesthetic.

## Task Breakdown

- [ ] **Infrastructure Setup**
  - [ ] Install/Configure `next-themes`
  - [ ] Create `ThemeProvider` component
  - [ ] Integrate into `RootLayout`

- [ ] **Global Styling (Tailwind v4)**
  - [ ] Define `:root` variables for Light Mode in `globals.css`
  - [ ] Update utility classes (`.glass-panel`, `.app-shell-gradient`) for light mode
  - [ ] Audit all system colors for AA contrast

- [ ] **UI Implementation**
  - [ ] Build `ThemeToggle` component with Lucide icons
  - [ ] Integrate toggle into the Sidebar/Header
  - [ ] Audit Dashboard components (Stats, Activity) for light mode polish

- [ ] **Deep Dive: Page Builder**
  - [ ] Update `WidgetBuilderHeader` for theme awareness
  - [ ] Audit all builder tabs (`Behavior`, `Deployment`, `Agents`, `Knowledge`)
  - [ ] Refine input fields and modal surfaces for light mode

- [ ] **Verification**
  - [ ] Verify persistence across sessions
  - [ ] Test system preference synchronization
  - [ ] Final visual polish on mobile and desktop

## Implementation Protocol

1. **Analysis**: Audit current CSS variables in `globals.css`.
2. **Strategy**: Target a "Cool Slate" light theme (Slate-900 text on White background).
3. **Execution**: Start with the `ThemeProvider` and `globals.css` inversion.
4. **Validation**: Use the browser tool to inspect UI transitions.

## Agent Assignments

- **Frontend Specialist**: Responsible for CSS variable mapping and UI components.
- **Orchestrator**: Coordinate the layout and layout changes.

Next steps: 
- Run `/create` to start implementation once approved.
