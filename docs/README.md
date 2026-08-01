# Agentergroup Documentation

Welcome to the technical documentation for Agentergroup. This directory contains the architectural blueprints and guides for maintaining and extending the platform.

## 🏗️ [Architecture](./architecture/core.md)
Detailed overview of the system design, database schema, and agent orchestration flow.

## 🧭 Product Vision & Roadmap
- **[Agent-Native Websites](./roadmap/agent-native-websites.md)** - Industry-neutral product vision for a Website Agent that powers a standalone Agent Site and embedded Chat Widget. Phase 0 selects the first niche and outcome; the existing Builder and Connections remain shared platform capabilities.
- **[Agent-Native Websites: Implementation Plan](./roadmap/agent-native-websites-implementation-plan.md)** - Dependency-ordered work packages that prioritize Website Agent, preserve Automation Agent behavior, defer new Internal Assistant work, and define release gates, rollback paths, and compatibility rules.

## 📘 Guides
Practical instructions for common tasks:
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
- **[Privacy Operations](./guides/privacy-operations.md)** - GDPR and data processing details.
- **[Operations Runbook](./runbooks/operations.md)** - Release verification, health checks, backup/restore, and widget-runtime deploy notes.
- **[Production Readiness](./runbooks/production-readiness.md)** - Hardening migration order, RLS verification, billing/upload rollout, and known manual steps.

## 🔑 Key Pages
Public-facing legal and auth pages:
- `/terms-of-service` — Terms of Service (added May 2026; see `src/app/terms-of-service/page.tsx`)
- `/privacy-policy` — Privacy Policy
- `/signup` — Legacy redirect into the main login flow
- `/invite/accept` — Public workspace invite acceptance page (unauthenticated-friendly; moved from the `(app)` route group)

---
*Last updated: July 30, 2026.*
