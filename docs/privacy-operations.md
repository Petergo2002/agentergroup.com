# Privacy Operations

Last updated: 2026-03-23

## Purpose

This document is the internal operating guide for the current GDPR/privacy controls implemented in the Agentergroup product.

It is not legal advice. It describes what the product currently does, how operators should use it, and where the known limitations are.

## Scope of v1 Privacy Controls

Current scope:

- public widget conversations
- public widget leads
- public widget session/activity data
- public privacy policy:
  - `/privacy-policy`
- signed-in customer compliance pages:
  - `/settings/subprocessors`
  - `/settings/data-processing`
- owner-only privacy handling inside workspace settings
- internal retention purge route

Out of scope in v1:

- public self-serve privacy portal
- automated identity verification
- per-workspace retention configuration
- retention automation for imported knowledge
- full privacy tooling for authenticated preview chat

## Current Subprocessors

Current primary subprocessors:

- Supabase
  - database, auth, storage, and core app infrastructure
- OpenRouter
  - model routing and LLM access
- Composio
  - connected account authentication and tool execution

Customer-facing compliance references are published inside the signed-in app on `/settings/subprocessors`.

## Current Retention Policy

Default v1 retention:

- `widget_sessions`
  - delete after 180 days based on `last_seen_at`
- `widget_session_messages`
  - deleted automatically when parent session is deleted
- `widget_leads`
  - delete after 180 days based on `created_at`
- widget session/activity metadata
  - retained through `widget_sessions`, since there is no separate widget events table

Manual retention:

- `knowledge_sources`
- `knowledge_chunks`
- stored knowledge files

These remain until the workspace deletes them manually.

## Retention Cron

Route:

- `POST /api/internal/privacy/retention`

Authentication:

- `Authorization: Bearer ${GDPR_RETENTION_CRON_SECRET}`

Recommended schedule:

- once daily
- low-traffic window
- example: `02:00 UTC`

Supported behavior:

- accepts `dryRun: true`
- returns deletion counts
- on live runs, writes workspace-scoped audit logs using `privacy.retention.run`

## Owner Workflow for Subject Requests

Surface:

- workspace Settings
- section: `Privacy & Compliance`

Access:

- workspace owners only

Supported lookup inputs:

1. exact email
2. exact session id

The app rejects requests that provide both or neither.

## Identity Verification Expectations

The product does not verify public requesters directly in v1.

Expected operational model:

- the website owner or Agentergroup support verifies the requester outside the product
- once verified, the owner uses the in-app export/delete tools
- request references should be recorded when deleting data

This is intentionally manual for v1.

## Export Procedure

1. Open the relevant workspace.
2. Go to `Settings`.
3. Open `Privacy & Compliance`.
4. Enter either:
   - exact email
   - exact session id
5. Run `Preview data`.
6. Review:
   - exact lead matches
   - structured session matches
   - transcript-only matches
7. Run `Export JSON`.
8. Store the export securely according to internal handling policy.

Notes:

- transcript-only matches are best-effort
- email lookup may surface transcript matches even if no lead record exists

## Delete Procedure

1. Verify requester identity outside the product.
2. Run `Preview data` in `Privacy & Compliance`.
3. Review the impact carefully.
4. Enter a `request reference`.
5. Type `DELETE`.
6. Choose whether transcript-only session matches should be included.
7. Run `Delete data`.

Deletion behavior:

- exact email mode:
  - deletes exact lead rows by default
  - transcript-only sessions are deleted only when explicitly included
- exact session id mode:
  - deletes the matched session
  - cascades message deletion
  - also deletes leads linked to that deleted session

Each delete action writes an audit log using `privacy.dsar.delete`.

## Limitations

- anonymous users without captured email require a session id or external evidence
- transcript matching is best-effort and content-based
- the product does not currently verify identity automatically
- imported knowledge is not automatically expired
- this does not yet cover all authenticated internal chats

## Incident Escalation

If there is a suspected privacy breach or accidental deletion:

- preserve timestamps and request details
- collect workspace id, actor id, and audit log entries
- escalate immediately through internal support/security channels
- review:
  - `audit_logs`
  - widget session data
  - relevant provider logs if needed

## Future Work

- public self-serve privacy request flow
- stronger requester verification
- configurable retention policies
- ticketing integration for privacy requests
- broader DSAR tooling for authenticated/internal chat data
