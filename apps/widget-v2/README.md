# Widget V2 - Standalone Embeddable Chat Widget

The official hosted and embeddable widget runtime for this repo.

## Development

```bash
npm install --prefix apps/widget-v2
npm run widget:dev
```

The widget will be available at `http://localhost:5173/`

## Testing with Widget Key

Add `?widget=YOUR_WIDGET_PUBLIC_KEY` to the URL:
```
http://localhost:5173/?widget=wgt_example123
```

## Building for Production

```bash
npm run widget:build
```

## Customer Integration

Customers add this script to their website:

```html
<script src="https://widget.agentergroup.com/loader.js" 
        data-widget="CUSTOMER_WIDGET_PUBLIC_KEY"></script>
```

## Environment Variables

- `VITE_API_BASE` - Base URL for the API (build-time, optional)
- `AG_WIDGET_API_URL` - Runtime override (set on `window`) for debugging local API from loader/widget

### Local debug override example

```html
<script>
  window.AG_WIDGET_API_URL = "http://localhost:3000";
</script>
<script src="https://widget.agentergroup.com/loader.js" data-widget="CUSTOMER_WIDGET_PUBLIC_KEY"></script>
```

## File Structure

```
src/
├── main.tsx          # Entry point
├── Widget.tsx        # Main widget component
├── hooks/
│   └── useSession.ts # Session persistence
└── index.css         # Styles

public/
└── loader.js         # Customer embed script
```
