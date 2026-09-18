# Observability: Error Reporting

How Avenro reports failures it would otherwise lose, and how to configure,
verify and debug that reporting.

> **Two different things share the word "observability".** This runbook is about
> **failure reporting** — `src/lib/observability/report.ts` and the Sentry
> integration. It is unrelated to **agent run observability**
> (`src/lib/runtime/observability.ts`, the `runs` / `run_steps` / `audit_logs`
> tables), which records what an agent did and is documented in
> [Core Architecture](../architecture/core.md#observability-and-debugging).

---

## The governing property: inert without a DSN

Nothing here is required. With no `SENTRY_DSN` set, the application builds,
starts and behaves identically, and reports nothing to any third party. Every
integration point is guarded:

- `register()` returns early when the DSN is missing
- `onRequestError` still writes its structured log line, and only calls Sentry
  when a DSN exists
- `reportError()` always logs; the Sentry capture is best-effort on top
- Sourcemap upload disables itself when upload credentials are absent

This means a contributor can clone the repository and run it with no Sentry
account, and CI does not need Sentry credentials to build.

---

## What reports errors

| File | Catches |
| --- | --- |
| `src/instrumentation.ts` | Server and edge init, plus `onRequestError` — thrown Server Actions, route-handler exceptions, and Server Component render failures. |
| `src/instrumentation-client.ts` | Browser init and App Router navigation instrumentation. |
| `src/app/global-error.tsx` | Root-layout failures, which `(app)/error.tsx` cannot catch. Self-contained inline styles and no i18n, because the providers may be what crashed. |
| `src/lib/observability/report.ts` | The application-level API everything else calls. |

### The reporting API

```ts
reportError(error, context, severity?)   // logs, then captures
reportWarning(error, context)            // severity: "warning"
reportRequestErrorLog(error, context)    // log only — see below
sanitizeReportContext(context)           // exported for tests
```

`ReportContext` requires an `operation` and accepts identifiers
(`workspaceId`, `agentId`, `widgetId`, `widgetSessionId`, `leadId`,
`knowledgeSourceId`, `requestId`, `route`, `jobType`) plus arbitrary extra keys.

`reportRequestErrorLog` exists so `onRequestError` can emit a greppable log line
without double-capturing: Sentry's own `captureRequestError` handles the Sentry
side there, because it attaches request metadata and trace linkage that a plain
`captureException` does not.

### Context is redacted before it leaves the process

`sanitizeReportContext` drops any key matching
`token|secret|password|passwd|authorization|auth|cookie|apikey|signature|dsn|credential|bearer|privatekey|sessionkey|accesskey`,
and normalises separators first, so `private_key`, `private-key` and
`privateKey` are all caught. String values are truncated to 256 characters.

Covered by `tests/security/observability-redaction.test.ts`.

---

## Configuration

All optional. See `.env.example` for the canonical list.

| Variable | Where it belongs | Without it |
| --- | --- | --- |
| `SENTRY_DSN` | Hosting environment | Server/edge reporting is off |
| `NEXT_PUBLIC_SENTRY_DSN` | Hosting environment (same value) | Browser reporting is off, and the CSP gains no Sentry origin |
| `SENTRY_TRACES_SAMPLE_RATE` | Hosting environment | Defaults to `0` — tracing is opt-in |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Hosting environment | Defaults to `0` |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Build environment | Sourcemap upload is skipped |
| `SENTRY_AUTH_TOKEN` | Build environment **only** | Sourcemap upload is skipped; the build still succeeds |

A DSN is a public key by design and ships in the client bundle. The auth token
is not — it belongs in the hosting/CI environment and nowhere else.

---

## What Sentry is allowed to collect

Both runtimes set `dataCollection` **explicitly**:

```ts
{ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false }
```

This is a privacy control, not a style preference, and must not be replaced with
the deprecated `sendDefaultPii` flag:

- In Sentry v10 each `dataCollection` category defaults to **collecting**, and
  `sendDefaultPii: false` does not cover them.
- On the widget chat routes, request bodies are **other companies' customers'
  conversations**. The defaults would have shipped those, plus cookies and
  `Authorization` headers, to a third party.
- `httpBodies: []` — an empty array — disables body collection entirely.

Session Replay is pinned off (`replaysSessionSampleRate: 0`,
`replaysOnErrorSampleRate: 0`) for the same reason: it records sessions
verbatim, and those sessions contain customer conversations.

The identifiers attached through `reportError()` are sufficient to debug without
any of the above.

---

## Content Security Policy

`src/lib/security-headers.ts` derives the ingest origin from
`NEXT_PUBLIC_SENTRY_DSN` and adds it to `connect-src`. Without this the browser
silently blocks every event — the SDK reports success and nothing arrives.

Because the origin is derived from the DSN rather than hardcoded, EU-region
projects (`*.ingest.de.sentry.io`) work without a code change.

---

## Sourcemaps and releases

`next.config.ts` wraps the config with `withSentryConfig` (imported from
`@sentry/nextjs/config`). Behaviour:

- Upload is disabled unless org, project and auth token are all present
- `deleteSourcemapsAfterUpload: true` keeps maps out of the deployed bundle
- `widenClientFileUpload: true`
- `errorHandler` warns instead of throwing, so a Sentry outage cannot fail a deploy
- `telemetry: false`; `silent` unless running in CI

Each deploy creates a release named after the commit SHA, with sourcemaps bound
to it. Verify in Sentry under **Settings → Projects → <project> → Source Maps**.

---

## Verifying

```bash
npm run verify:sentry
```

Sends one test event through the same code path the application uses and flushes
before exiting. It proves DSN validity, network reachability and that the
capture API resolved — it does **not** prove the CSP is correct, because it does
not run in a browser.

Resolve the resulting test issue in Sentry afterwards.

---

## The two CLIs

They are unrelated tools with similar names. Do not mix them up.

| | `sentry-cli` | `sentry` |
| --- | --- | --- |
| Source | `node_modules/.bin/sentry-cli` | `~/.local/bin/sentry`, from `cli.sentry.dev` |
| Purpose | Build-time: releases, sourcemap upload | Reading data: `issue list`, `issue view`, `issue explain` |
| Auth | `SENTRY_AUTH_TOKEN` | Its own OAuth credential (`sentry auth login`) |
| Runs in | CI / Vercel builds | A developer's machine |

Installing the agent CLI also installs a `sentry-cli` agent skill and appends a
PATH line to the shell profile.

---

## Troubleshooting

**`403 Forbidden` reading issues with `SENTRY_AUTH_TOKEN`.**
Expected. That token is scoped `org:ci`, which is exactly what sourcemap upload
needs and nothing more. **Do not widen its scopes.** Use the `sentry` CLI's own
OAuth credential to read data.

**The `sentry` CLI 403s even after `sentry auth login`.**
An exported `SENTRY_AUTH_TOKEN` takes precedence over the stored OAuth
credential. `unset SENTRY_AUTH_TOKEN` first.

**`flush()` returns true but nothing arrives in Sentry.**
Two known causes, both previously hit here:

1. **CSP** — the ingest origin is missing from `connect-src`. Browser only.
2. **Module interop** — under some Node resolutions `@sentry/nextjs` resolves to
   a CJS build where `captureException` lives on `.default` rather than the
   namespace. `resolveSentryCaptureApi()` in `report.ts` checks both shapes and
   warns once rather than silently swallowing the failure. If reporting ever
   goes quiet, look for that warning first.

**EU region.** The org is EU-hosted (`ingest.de.sentry.io`). A `sntrys_` token
embeds its own host and ignores a manually set `SENTRY_URL`; that warning is
harmless.

---

## Known gaps

- No alert routing beyond Sentry's default new-issue rule.
- Leaked-password protection in Supabase Auth is a separate, still-open item —
  see [Production Readiness](./production-readiness.md).

---

*Last updated: September 17, 2026.*
