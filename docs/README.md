# Avenro Documentation

Technical documentation for the Avenro platform. Every document in this index
describes the **current, verified state** of the codebase. Anything that no
longer does has been moved to [`archive/`](./archive/README.md) with a banner
explaining what superseded it.

**Verified on 18 September 2026:** Next.js 16.3.4 · React 19.2.8 · Tailwind CSS v4
· Supabase with 109 migrations and RLS tenant isolation · Vite/React 18 widget
runtime in `apps/widget-v2` · 442/442 tests passing · 0 TypeScript errors · 0
ESLint warnings.

## Current Product Model

Avenro is Milo-first. A Milo workspace presents one AI employee and one Website
Chat rather than separate agent and widget inventories.

```text
Milo
├── Builder: instructions, model, Knowledge, tools, and testing
├── Website Chat: appearance, visitor copy, behavior, preview, and publishing
├── Leads + Analytics: customer outcomes and conversation history
└── Improve Milo: owner-reviewed answers that become verified Knowledge
```

This is a customer-facing facade over the existing versioned agent and Widget V2
architecture. Classic multi-agent workspaces, Automation Agents, and Internal
Assistants remain supported implementation capabilities. The Agent Site / native
website is a **roadmap proposal**, not part of the current Website Chat release.

---

## 🏛️ Architecture & System Design

| Document | What it covers |
| --- | --- |
| **[Core Architecture](./architecture/core.md)** | The operational source of truth: system design, database schema, agent orchestration, and runtime flow. Start here. |
| [Analytics Architecture](./architecture/core.md#analytics-architecture) | Workspace conversation analytics and automation performance reporting. |
| [Knowledge Base Architecture](./architecture/core.md#knowledge-base-architecture) | Multi-page website scraping, sitemap mapping, and document ingestion. |
| [Supabase Runtime Keys](./architecture/core.md#supabase-edge-functions) | Current `sb_secret_...` admin-key setup and Edge Function auth expectations. |

## 📘 Core Product Guides

### Milo & the agent runtime
- **[Milo Single-Agent Experience](./guides/milo-experience.md)** — Product facade, provisioning, stable routes, invariants, rollout, and rollback.
- **[Agent Builder](./guides/agent-builder.md)** — How the flow-based builder works.
- **[Agent Library](./guides/agent-builder.md#agent-library)** — How verified agent templates are submitted, reviewed, and imported.
- **[Automation Agents](./guides/automation-agents.md)** — External triggers, activation, Activity, and tool execution.

### Website Chat & widget
- **[Widget Embed Security](./guides/widget-embed-security.md)** — Security protocols for public embeds.
- **[Widget Conversation History](./guides/widget-conversation-history.md)** — Anonymous visitor capability tokens, preview/live source scoping, and returning-visitor history.
- **[Widget Realtime Voice](./guides/widget-realtime-voice.md)** — Product decision and future direction for Gemini Live voice mode.

### Leads & the improvement loop
- **[Lead Conversation Summaries](./guides/lead-conversation-summaries.md)** — AI summary generation, persistence, regeneration, security, and operational behavior.
- **[Questions / Data Flywheel](./guides/questions-data-flywheel.md)** — How missed widget questions are detected, deduped, reviewed, and published back into agent knowledge.

### Knowledge & integrations
- **[Knowledge Processing](./guides/knowledge-processing.md)** — Ingestion and processing pipeline.
- **[Composio Integrations](./guides/composio-integrations.md)** — Tool execution, connected-account sync, and lifecycle webhooks. **Read before writing any Composio tool integration.**
- **[Adding Integrations](./guides/adding-integrations.md)** — Extending toolkits end to end.

### Design & commercial
- **[UI Patterns](./guides/ui-patterns.md)** — Brand tokens, semantic CSS, shared dashboard surfaces, CTAs, and layout conventions. **The design source of truth.**
- **[Manual Plan Activation](./guides/manual-plan-activation.md)** — Managed pilot onboarding, Admin plan approval, and hidden self-serve billing.
- **[Privacy Operations](./guides/privacy-operations.md)** — GDPR, DSAR handling, and retention.

## 🚀 Launch & Operations Runbooks

| Runbook | Use it when |
| --- | --- |
| **[Production Readiness](./runbooks/production-readiness.md)** | Shipping. Hardening migration order, RLS verification, the release gate, private-beta status, and **[known open findings](./runbooks/production-readiness.md#known-open-findings-carried-forward-from-archived-audits)**. |
| **[Operations](./runbooks/operations.md)** | Running it. Release verification, health checks, backup/restore, and widget-runtime deploy notes. |
| **[Demo Tester Release Checklist](./runbooks/demo-tester-release-checklist.md)** | Before inviting testers. Gate list that must be complete and verified from a clean build. |
| **[avenro.se: Vercel och one.com](./runbooks/avenro-domain-setup.md)** | Domains and DNS. Domäner, DNS, Widget V2, inloggning och e-post. *(Svenska)* |
| **[Transactional Email](./runbooks/transactional-email.md)** | Email design. The shared template system, Resend setup, and installing the Supabase Auth templates. |
| **[Observability](./runbooks/observability.md)** | Error reporting. Sentry configuration, what it is allowed to collect, sourcemaps, the two CLIs, and why reporting goes quiet when it does. |

## 🔒 Security & Compliance

- **[Compliance Inventory](./security/compliance-inventory.md)** — Evidence inventory, defensible framework claims, and gaps by priority. Reviewed 2026-09-10.
- **[Security Best-Practices Review](./security/best-practices-review.md)** — Resolved findings, confirmed controls, and live remaining items. Reviewed 2026-08-08.

## 📋 Active Roadmap & Refinement Boards

| Board | Status |
| --- | --- |
| **[Performance Audit 2026-09-11](./roadmap/performance-audit-2026-09-11.md)** | **Active.** Function/database region mismatch and the per-navigation waterfall. A1 (loader concurrency), A2 (verified single-call auth), and analytics aggregation are done; the remaining findings table is the live backlog. |
| **[UI & UX Refinement Board](./roadmap/ui-ux-refinement-board.md)** | **Active.** Phase 1 complete; Phases 2–5 (Agents, Leads, Knowledge, Analytics) open. |
| [Pre-Launch Hardening 2026-09-18](./roadmap/pre-launch-hardening-2026-09-18.md) | **Complete & merged.** Multi-call tool dispatch, interrupted-stream detection, billing usage reset on renewal, raw debug-trace removal on the public path, immediate revocation, document uploads gated off. Retained as the implementation record; carries what was deliberately left gated. |
| [Production Hardening 2026-09-17](./roadmap/production-hardening-2026-09-17.md) | **Complete & merged** (PR #7). Observability, bounded upstream calls, server-side analytics aggregation, behavioural security tests, duplicate-index removal. Retained as the implementation record; carries the remaining deferred items. |
| [Widget V2 Remediation](./roadmap/widget-v2-remediation.md) | **Complete & verified.** Trigger fast-paths, dynamic summary refresh, loader query concurrency, dead-code cleanup. Retained as the implementation record. |
| [Milo Single-Agent Implementation Plan](./roadmap/milo-single-agent-experience-implementation-plan.md) | **Implemented.** Product contract, migration phases, verification, compatibility, and rollback. |
| [Agent-Native Websites](./roadmap/agent-native-websites.md) | **Proposed — not started.** Future Agent Site delivery mode for the same Milo that powers Website Chat. |
| [Agent-Native Websites: Implementation Plan](./roadmap/agent-native-websites-implementation-plan.md) | **Proposed — awaiting approval.** Dependency-ordered future work; authorizes no implementation. |

## 🗄️ Historical Audits & Archive

**[Browse the archive →](./archive/README.md)**

Superseded audits and completed plans, each carrying a banner naming what
replaced it. Kept for reasoning and decision history — **never as a status
report**. If an archived document contradicts one above, the document above wins.

## 🔑 Key Public Pages

- `/terms-of-service` — Terms of Service (`src/app/terms-of-service/page.tsx`)
- `/privacy-policy` — Privacy Policy
- `/signup` — Legacy redirect into the main login flow
- `/invite/accept` — Public workspace invite acceptance (unauthenticated-friendly)

---

## Keeping this index true

1. A document that stops describing the present goes to [`archive/`](./archive/README.md) — move its still-open findings into a living document **first**.
2. Point-in-time figures (test counts, migration counts, versions) belong in as few documents as possible. [Production Readiness](./runbooks/production-readiness.md) is authoritative for release state; prefer linking to it over restating numbers.
3. After editing links, re-run the link check from the repository root:
   ```bash
   python3 scripts/check-doc-links.py
   ```

*Last updated: September 18, 2026.*
