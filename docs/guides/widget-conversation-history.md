# Widget Conversation History

Returning visitors can reopen their earlier Website Chat conversations from the same browser, and operators see their real previous conversations inside the builder preview.

## Visitor identity model

History is bound to an anonymous **visitor capability token**, not to a login.

- The widget generates 32 random bytes (`crypto.getRandomValues`) on first use and stores the hex string in `localStorage`.
- Every runtime request sends it as the `x-ag-widget-visitor-token` header.
- The server stores only `sha256("widget-visitor-v1:<widgetId>:<token>")` in `widget_sessions.visitor_token_hash`. **The raw token is never persisted.**
- Because the hash is salted with the widget id, the same browser token produces a different hash per widget. One widget's history can never be correlated with another's.

Token format is validated before use (`normalizeWidgetVisitorToken`): 32–128 chars, `[A-Za-z0-9_-]` only. A malformed token is treated as absent.

Source: `src/lib/widgets/visitor.ts`.

### Storage keys

| Scope | Key | Lifetime |
| --- | --- | --- |
| Live embed/hosted | `ag_widget_visitor_v1_<widgetPublicKey>` | persistent |
| Builder preview | `ag_widget_visitor_v1_preview_<widgetPublicKey>` | persistent |
| Session id (live) | `ag_widget_session_v2_<widgetPublicKey>` | persistent (`localStorage`) |
| Session id (preview) | in-memory only | per mount |

Preview and live keep **separate** visitor identities so operator testing never mixes into a real visitor's history on the same browser.

The live session id moved from `sessionStorage` to `localStorage` so a conversation survives closing the tab. Existing `sessionStorage` values are migrated transparently on first load. Every storage access is wrapped in `try/catch` — privacy-restricted browsers fall back to an in-memory session and simply get no history.

## Ownership enforcement

`visitor_token_hash` is a capability, and every route that reads or writes a session checks it:

- `chat`, `complete`, `leads`, `upload` reject a mismatch with `403 CONVERSATION_ACCESS_DENIED`.
- `conversations` requires a token outright (`401 VISITOR_TOKEN_REQUIRED`) and filters every query by the hash.

`canAccessWidgetSession` returns `true` when the stored hash is `null`, so sessions created before this feature stay reachable rather than locking out in-flight conversations. Once a session has a hash, only that browser can continue it.

This is **in addition to**, not instead of, the existing origin/access-token checks — a visitor token alone grants nothing.

## Source scoping: preview vs live

Preview and live sessions share `widget_sessions`, separated by the `source` column. Every history read is pinned to exactly one source (`scopeToRuntimeSource` in the conversations route):

- preview access (`x-ag-preview-token`) → `source = 'preview'`
- live access (widget access token) → `source <> 'preview'`

A builder preview therefore shows the operator's real preview conversations and never a customer's, and a visitor never sees draft-testing chatter. Previews run against unpublished drafts, so the `status = 'deployed'` gate applies to live runtimes only.

> The builder preview previously rendered two hardcoded sample conversations. That fixture was removed — the preview now reads real history through the same API as production.

## API

`GET /api/public/widgets/[widgetPublicKey]/conversations`

| Request | Returns |
| --- | --- |
| no query | up to 20 summaries, newest first, only sessions with a visitor message |
| `?sessionId=…` | one conversation with up to 100 `user`/`assistant` messages |

Responses are `Cache-Control: private, no-store`. Rate limited under the `history` endpoint rules (120/min per IP, 60/min per widget+IP).

Attachments are **re-signed on read** (1h TTL) rather than storing URLs, so a restored transcript never carries a dead or leaked link. The whole transcript is resolved with one `widget_attachments` query and one `createSignedUrls` batch per bucket.

Titles and previews are derived from message text at write time (`buildConversationTitle` 72 chars, `buildConversationPreview` 120 chars) and stored on the session, so the list never has to read messages.

## Client behavior

`apps/widget-v2/src/Widget.tsx` + `components/ConversationList.tsx`.

- **Skeletons only on first load.** Later refreshes — on open, after a turn, on retry — revalidate underneath the rendered rows. A failed background refresh keeps the rows it already had.
- **Prefetch.** The top 3 conversations are warmed while the visitor reads the list, so opening one costs no network round trip.
- **Row-level loading.** A conversation that still has to be fetched shows a spinner on its own row; the list is never swapped for skeletons.
- **Cache invalidation.** A completed turn drops the cached copy of that session; the list prefetch re-warms it.

Preview authenticates with a preview token and never receives a widget access token, so history readiness is resolved per runtime (`hasRuntimeAccess`) rather than assuming an access token exists.

## Schema

`supabase/migrations/20260911090730_widget_visitor_conversation_history.sql`

- `widget_sessions.visitor_token_hash text` — with a validated `^[0-9a-f]{64}$` check constraint
- `widget_sessions.conversation_title text`
- `widget_sessions.last_message_preview text`
- partial index on `(widget_id, visitor_token_hash, last_seen_at desc, id desc)` for non-preview sessions

`supabase/migrations/20260911143000_widget_preview_conversation_history_index.sql` adds the matching partial index for `source = 'preview'`.

## Tests

`tests/security/widget-conversation-history.test.ts` covers the token/hash model, source scoping, ownership enforcement across all four session routes, the storage-key separation, and the latency behaviors above.
