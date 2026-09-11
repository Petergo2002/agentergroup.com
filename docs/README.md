# Avenro Documentation

Welcome to the technical documentation for Avenro. This directory contains the architectural blueprints and guides for maintaining and extending the platform.

## Current Product Model

Avenro is Milo-first. A Milo workspace presents one AI employee and one Website Chat rather than separate agent and widget inventories.

```text
Milo
├── Builder: instructions, model, Knowledge, tools, and testing
├── Website Chat: appearance, visitor copy, behavior, preview, and publishing
├── Leads + Analytics: customer outcomes and conversation history
└── Improve Milo: owner-reviewed answers that become verified Knowledge
```

This is a customer-facing facade over the existing versioned agent and Widget V2 architecture. Classic multi-agent workspaces, Automation Agents, and Internal Assistants remain supported implementation capabilities. The future Agent Site/native website is a roadmap and is not part of the current Website Chat release.

## 🏗️ [Architecture](./architecture/core.md)
Detailed overview of the system design, database schema, and agent orchestration flow.

## 🧭 Product Vision & Roadmap
- **[Milo Single-Agent Implementation Plan](./roadmap/milo-single-agent-experience-implementation-plan.md)** - Implemented product contract, migration phases, verification, compatibility, and rollback.
- **[Agent-Native Websites](./roadmap/agent-native-websites.md)** - Proposed future Agent Site/native website delivery mode for the same Milo that currently powers Website Chat.
- **[Agent-Native Websites: Implementation Plan](./roadmap/agent-native-websites-implementation-plan.md)** - Dependency-ordered future work that extends the existing Milo and Widget V2 foundation without creating a second agent or conversation runtime.

## 📘 Guides
Practical instructions for common tasks:
- **[Milo Single-Agent Experience](./guides/milo-experience.md)** - Product facade, provisioning, stable routes, invariants, rollout, and rollback.
- **[Agent Builder](./guides/agent-builder.md)** - How the flow-based builder works.
- **[Agent Library](./guides/agent-builder.md#agent-library)** - How verified agent templates are submitted, reviewed, and imported.
- **[Automation Agents](./guides/automation-agents.md)** - How external triggers, activation, Activity, and tool execution work.
- **[Analytics Architecture](./architecture/core.md#analytics-architecture)** - Workspace conversation analytics and automation performance reporting.
- **[Knowledge Base](./architecture/core.md#knowledge-base-architecture)** - Multi-page website scraping, sitemap mapping, and document ingestion.
- **[Questions / Data Flywheel](./guides/questions-data-flywheel.md)** - How missed widget questions are detected, deduped, reviewed, and published back into agent knowledge.
- **[Supabase Runtime Keys](./architecture/core.md#supabase-edge-functions)** - Current `sb_secret_...` admin-key setup and Edge Function auth expectations.
- **[Adding Integrations](./guides/adding-integrations.md)** - Guide for extending toolkits.
- **[Composio Integration](./guides/composio-integrations.md)** - Details on tool execution, connected-account sync, and lifecycle webhooks.
- **[Lead Conversation Summaries](./guides/lead-conversation-summaries.md)** - AI summary generation, persistence, regeneration, security, and operational behavior.
- **[UI Patterns](./guides/ui-patterns.md)** - Shared dashboard surfaces, brand tokens, CTAs, and layout conventions.
- **[Manual Plan Activation](./guides/manual-plan-activation.md)** - Managed pilot onboarding, Admin plan approval, hidden self-serve billing, and future reactivation steps.
- **[Widget Realtime Voice](./guides/widget-realtime-voice.md)** - Product decision and future implementation direction for Gemini Live voice mode in the public widget.
- **[Widget Security](./guides/widget-embed-security.md)** - Security protocols for public embeds.
- **[Widget Conversation History](./guides/widget-conversation-history.md)** - Anonymous visitor capability tokens, preview/live source scoping, and returning-visitor chat history.
- **[Privacy Operations](./guides/privacy-operations.md)** - GDPR and data processing details.
- **[Operations Runbook](./runbooks/operations.md)** - Release verification, health checks, backup/restore, and widget-runtime deploy notes.
- **[avenro.se: Vercel och one.com](./runbooks/avenro-domain-setup.md)** - Domäner, DNS, Widget V2, inloggning och e-post vid domänbytet.
- **[Production Readiness](./runbooks/production-readiness.md)** - Hardening migration order, RLS verification, billing/upload rollout, and known manual steps.

## 📈 Performance
- **[Performance Audit 2026-09-11](./PERFORMANCE_AUDIT_2026-09-11.md)** - Function/database region mismatch, the per-navigation waterfall, and the remaining prioritized findings.
- **[Performance Audit Report (2026-08-05)](./PERFORMANCE_AUDIT_REPORT.md)** - Earlier point-in-time implementation report.

## 🔑 Key Pages
Public-facing legal and auth pages:
- `/terms-of-service` — Terms of Service (added May 2026; see `src/app/terms-of-service/page.tsx`)
- `/privacy-policy` — Privacy Policy
- `/signup` — Legacy redirect into the main login flow
- `/invite/accept` — Public workspace invite acceptance page (unauthenticated-friendly; moved from the `(app)` route group)

---
*Last updated: September 11, 2026.*
