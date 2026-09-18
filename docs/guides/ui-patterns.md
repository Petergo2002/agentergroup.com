# UI Patterns

Use these conventions for dashboard and app-section UI work.

## Brand Tokens

- Primary accent: `#FF5C02`
- Primary text and brand depth: `#181818`
- Secondary text: `#667085`
- Warm active/soft surface: `#FFF4EC`

Prefer the semantic CSS variables in `src/app/globals.css` instead of adding one-off hex colors.

## Shared Classes

Use these shared classes for main product screens:

- `app-page` for standard dashboard/app page spacing and max width.
- `app-page-compact` or `app-page-wide` when a page needs the established compact or wider variant.
- `app-section-header` for page headers.
- `app-card` for cards, panels, and repeated item surfaces.
- `app-filter-panel` for search/filter toolbars.
- `app-empty-state` for empty states.
- `app-kicker` for small accent labels above page titles.
- `app-primary-button` for primary actions.
- `app-secondary-button` for secondary actions.

## Button Contrast

Use `text-on-primary` on primary orange buttons. Do not use white text on `#FF5C02` for normal-sized UI text.

Use dark or error-specific buttons only when the action is not a normal primary workflow, such as destructive confirmation.

## Layout Rules

- Keep page headers first, then summary/filter controls, then the main work area.
- Use one dominant primary action per header when possible.
- Keep tables and work queues dense but separated with clear row hover and selected states.
- Use empty states with a clear title, short explanation, and an action when the user can do something next.

## Accessible Overlays and Feedback

- Use the shared `Modal` component for modal workflows. It provides dialog naming, focus placement and containment, Escape handling, focus restoration, and body-scroll restoration.
- Keep the mobile navigation drawer inert and hidden from assistive technology while it is closed.
- Use `ToastProvider` for transient outcomes. Errors are announced assertively; success, warning, and informational notices use a polite status announcement.
- Preserve `focus-visible` styles and provide an accessible name for icon-only controls.

### Interaction defaults you get for free

`globals.css` sets these in the **base** layer, wrapped in `:where()` so their
specificity is zero. Any component that declares its own focus or cursor
utilities still wins, so these are a floor, not an override:

| Rule | Applies to |
| --- | --- |
| A `focus-visible` outline in the brand colour, offset 2px, inheriting the element's radius | `button`, `[role="button"]`, `a[href]`, `summary` |
| `cursor: pointer` | The same elements, when not `:disabled` or `[aria-disabled="true"]` |
| `cursor: not-allowed` | Disabled buttons, inputs, textareas and selects |

The `cursor: pointer` default exists because Tailwind's Preflight resets buttons
to `cursor: default`, and only a handful of call sites had re-added it — so most
buttons in the app showed an arrow rather than a hand.

**Do not add a competing global focus rule for form fields.** Inputs already get
a focus ring from `@plugin "@tailwindcss/forms"`, and a `:where()` rule cannot
beat it (specificity 0). Style inputs at the component level instead.

## Liquid Glass Controls & Segmented Switches

For elevated navigation switches (e.g. `AgentViewTabs` switching between **BUILDER** and **TEST MILO**), use the **Liquid Glass Segmented Control** pattern:

- **Frosted Glass Container:** Rounded pill tray (`rounded-full p-1 isolate`) with `backdrop-blur-xl`, subtle border opacity (`border-outline-variant/15 dark:border-white/10`), and multi-layer specular inner inset highlights.
- **Sliding Liquid Glass Thumb:** Floating indicator pill with multi-stop refractive gradient (`from-white/95 via-white/85 to-white/70` in light, obsidian glass in dark mode), 2.5D top refraction sheen arc, and ambient brand liquid warmth.
- **Hardware-Accelerated Fluid Physics:** Uses GPU-accelerated `translate3d` transforms with Apple's `cubic-bezier(0.16, 1, 0.3, 1)` spring curve over 300ms for fluid sliding motion with zero layout shifts.
- **Optimistic Immediate Feedback:** Active tab state updates immediately on click (`setActiveTab`) to start gliding instantly before Next.js client-side route transitions complete.
- **No Purple/Violet:** Strictly adheres to curated warm amber/coral brand accents and neutral translucent glass.

## Brand Assets & Vector Identity

Use the official SVG brand components from `src/components/brand/` instead of raw image tags:

- `<AvenroLogo />` (`src/components/brand/AvenroLogo.tsx` or `BrandLogo.tsx`) for the full wordmark.
- `<AvenroIcon />` (`src/components/brand/AvenroIcon.tsx`) for compact, square, or collapsed sidebar icon states.
- All brand references use **Avenro AB** and **Avenro** across auth, layout, metadata, email, and locales.

