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
