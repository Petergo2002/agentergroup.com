# Phase 3: Runtime, Reliability, Observability, and Scale

## Objective

Turn the Phase 2 conversational product into a safer and more observable platform before adding heavier orchestration.

## Primary Outcome

At the end of Phase 3, the platform should support:

- repeatable conversational execution
- structured run traces
- approval-ready controls
- clearer agent lifecycle management
- a clean foundation for later async orchestration

## Trigger.dev Position

Trigger.dev should not drive this phase until the core runtime is observable and the real Composio tool set is finalized.

Phase 3 should first establish:

- run traces
- approval scaffolding
- lifecycle controls
- rollback support
- auditability

Then Trigger.dev can be added on top in a later pass for:

- long-running jobs
- retries
- schedules
- event-driven execution
- resumable approvals

## Scope

### Runtime Observability

Implement:

- Step-level run traces
- Tool usage traces
- Structured failure reasons
- Better run status handling
- Approval-required run states

### Reliability Controls

Implement:

- Guardrails for risky tools
- Approval records for sensitive actions
- Audit logging
- Clear lifecycle events

### Publishing and Lifecycle

Implement:

- Publish flow for agents
- Version history
- Rollback support
- Archive behavior

### Async Expansion

Only after the above is stable:

- Scheduled runs
- Webhook-triggered runs
- Event-driven runs
- Human approval resumes
- Retries and cancellation flows

## Optional Expansion Areas

Only after the core reliability work is stable:

- Shared templates
- Public embeds
- Agent sharing
- Team collaboration features
- Usage billing
- Internal analytics

## Non-Goals

Phase 3 should avoid unnecessary platform sprawl before runtime stability is proven.

Do not prioritize:

- Cosmetic redesign work
- New surface-area pages without operational value
- Broad marketplace expansion before reliability exists

## Deliverables

- Structured logs and traces
- Approval and safety controls
- Agent publishing and rollback model
- Archive and restore behavior

## Acceptance Criteria

- Failed runs can be diagnosed through logs and trace data
- Sensitive actions can require approval
- Published agents have clear version history and rollback support
- Agents can be archived and restored without losing history

## Engineering Notes

- Keep the execution engine separate from page-level UI
- Prefer stable internal contracts between builder, database, and runtime
- Expand supported agent behavior only after observability is good enough to debug failures
- Add Trigger.dev only after the approval and trace model is stable enough to support async execution
