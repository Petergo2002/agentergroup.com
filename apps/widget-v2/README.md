# Widget V2 - Standalone Embeddable Chat Widget

The official hosted and embeddable widget runtime for this repo.

## Development

```bash
npm install --prefix apps/widget-v2
cp apps/widget-v2/.env.example apps/widget-v2/.env.local
npm run widget:dev
```

The widget will be available at `http://localhost:5173/`.

For a static local embed page, use `apps/widget-v2/examples/local-loader-test.html`.

## Testing with Widget Key

Add `?widget=YOUR_WIDGET_PUBLIC_KEY` to the URL:
```
http://localhost:5173/?widget=wgt_example123
```

For hosted-widget testing against the local Next.js app, keep the hosted origin aligned with `NEXT_PUBLIC_WIDGET_APP_URL`. With the default repo setup, use `http://localhost:5173`, not `http://127.0.0.1:5173`.

Hosted standalone mode is desktop-first on large breakpoints. When you open `/?widget=...` locally, the expected behavior is a wide desktop surface on `lg+`, while the compact mobile shell remains for narrow screens.

## Building for Production

```bash
npm run widget:build
```

## Deployment

`apps/widget-v2` is deployed separately from the Next.js dashboard app.

- deploy the dashboard app when public widget API routes or server logic change
- deploy the widget runtime project when `apps/widget-v2` UI or runtime-client behavior changes
- hosted URLs such as `https://widget.agentergroup.com/?widget=...` will keep serving the old frontend bundle until the widget runtime project is redeployed

## Customer Integration

Customers add this script to their website:

```html
<script src="https://widget.agentergroup.com/loader.js" 
        data-widget="CUSTOMER_WIDGET_PUBLIC_KEY"></script>
```

Use `data-widget`. `data-id` is still accepted for backward compatibility, but it is deprecated.

## Runtime Behavior

- `bootstrap` validates whether the request is hosted, embedded, or preview and returns a short-lived signed widget access token.
- The widget access token currently uses a 15-minute TTL.
- Widget styling is intentionally simplified to `theme`, `primaryColor`, and `secondaryColor`.
- Runtime agent presentation comes from persisted widget-agent config supplied by the Next.js app, including specialist display labels, greetings, placeholders, quick-action visibility, and quick actions.
- Hosted standalone mode uses a dedicated desktop shell on large breakpoints instead of reusing the embedded/mobile card proportions.
- Hosted widget requests refresh bootstrap directly when they get `WIDGET_ACCESS_TOKEN_INVALID`.
- Embedded widget requests ask the loader to refetch bootstrap through the parent-page origin via `ag:widget-bootstrap:refresh`.
- Public chat is serialized per session. If the same session sends overlapping turns, the second request is rejected with `409 SESSION_BUSY`.
- Runtime requests are accepted only from the widget runtime origin set, not from arbitrary reflected origins.
- Public widget rate limiting is enforced server-side through the dashboard API and the backing SQL upsert must target a named uniqueness constraint to avoid ambiguous `window_started_at` conflicts inside the RPC.

## Config Contract

The widget runtime expects the public bootstrap/config payload to include:

- widget branding and theme from the current `widgets` row
- per-specialist config from the current `widget_agents` row
- `showQuickActions` plus `quickActions` for each specialist

Preview and deployed runtime should now render the same saved specialist configuration.

## Load Testing

The repo includes a load-test harness for the public widget runtime:

```bash
npm run widget:load-test -- \
  --base-url http://localhost:3000 \
  --widget-public-key wgt_example123 \
  --widget-origin http://localhost:5173 \
  --mode hosted
```

The harness exercises `bootstrap` and `chat`, records latency, and includes a same-session double-submit scenario to verify `SESSION_BUSY` behavior.

## Environment Variables

- `VITE_API_BASE` - Base URL for the API (build-time, optional)
- `AG_WIDGET_API_URL` - Runtime override (set on `window`) for debugging local API from loader/widget
- `data-api-url` - Per-script runtime override for embedding the loader into another local repo/site

### Local debug override example

```html
<script>
  window.AG_WIDGET_API_URL = "http://localhost:3000";
</script>
<script src="https://widget.agentergroup.com/loader.js" data-widget="CUSTOMER_WIDGET_PUBLIC_KEY"></script>
```

### Preferred localhost embed example for another repo

```html
<script
  src="http://localhost:5173/loader.js"
  data-widget="CUSTOMER_WIDGET_PUBLIC_KEY"
  data-api-url="http://localhost:3000"
></script>
```

## File Structure

```
src/
├── main.tsx          # Entry point
├── Widget.tsx        # Main widget component
├── lib/api.ts        # Public widget API helpers and event transport
├── hooks/
│   └── useSession.ts # Session persistence
└── index.css         # Styles

public/
└── loader.js         # Customer embed script and embedded bootstrap handoff

examples/
└── local-loader-test.html  # Manual local test page for the hosted loader
```
