# Archive

Point-in-time audits and completed plans, kept for their reasoning and for the
record of *why* decisions were made. **Nothing here is a status report.**

Every document in this folder carries a warning banner at the top explaining
what superseded it. If an archived document and a living document disagree, the
living document wins — always.

| Archived document | Was | Archived because | Live replacement |
| --- | --- | --- | --- |
| [project-audit-2026-09-05.md](./project-audit-2026-09-05.md) | `PROJECT_AUDIT_2026-09-05.md` | Point-in-time audit. 5 of its 8 findings are resolved; its verification table (227 tests, 1,553 lint errors, Next 16.3.0) contradicts the current tree (355 tests, 0 lint errors, Next 16.3.4). | [Production Readiness](../runbooks/production-readiness.md) |
| [domain-change-audit-2026-09-06.md](./domain-change-audit-2026-09-06.md) | `DOMAIN_CHANGE_AUDIT_2026-09-06.md` | The migration it planned was executed on 7 September 2026. | [avenro.se setup runbook](../runbooks/avenro-domain-setup.md) |
| [performance-audit-2026-08-05.md](./performance-audit-2026-08-05.md) | `PERFORMANCE_AUDIT_REPORT.md` | Superseded. Its implemented phases remain in the code; its priorities were overtaken by the region-mismatch finding. | [Performance Audit 2026-09-11](../roadmap/performance-audit-2026-09-11.md) |
| [plan-data-flywheel.md](./plan-data-flywheel.md) | `PLAN-data-flywheel.md` | The feature shipped. | [Questions / Data Flywheel](../guides/questions-data-flywheel.md) |
| [plan-leads-ui.md](./plan-leads-ui.md) | `PLAN-leads-ui.md` | The redesign shipped; its unticked checkboxes misrepresent it as open work. | [UI Patterns](../guides/ui-patterns.md) |

## Findings carried forward

Three findings from the September 5 audit were still open when it was archived
and were **not** discarded with it. They are tracked in
[Production Readiness → Known Open Findings](../runbooks/production-readiness.md#known-open-findings-carried-forward-from-archived-audits):

1. Knowledge retrieval failures degrade answer grounding without a signal.
2. The automation event executor has no lease or reclaim for stuck events.
3. Model token usage is not captured, so per-turn cost is not accountable.

## Adding to this archive

When a document stops describing the present:

1. Move it here with a kebab-case name that keeps its date.
2. Add a `> [!WARNING]` banner naming what superseded it and what is now stale.
3. Move any still-open findings into a living document **before** archiving.
4. Add a row to the table above and remove it from [`docs/README.md`](../README.md).
