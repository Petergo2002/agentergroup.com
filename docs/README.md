# Agentergroup Documentation

Welcome to the technical documentation for Agentergroup. This directory contains the architectural blueprints and guides for maintaining and extending the platform.

## 🏗️ [Architecture](./architecture/core.md)
Detailed overview of the system design, database schema, and agent orchestration flow.

## 📘 Guides
Practical instructions for common tasks:
- **[Agent Builder](./guides/agent-builder.md)** - How the flow-based builder works.
- **[Agent Library](./guides/agent-builder.md#agent-library)** - How verified agent templates are submitted, reviewed, and imported.
- **[Automation Agents](./guides/automation-agents.md)** - How external triggers, activation, Activity, and tool execution work.
- **[Knowledge Base](./architecture/core.md#knowledge-base-architecture)** - Multi-page website scraping, sitemap mapping, and document ingestion.
- **[Supabase Runtime Keys](./architecture/core.md#supabase-edge-functions)** - Current `sb_secret_...` admin-key setup and Edge Function auth expectations.
- **[Adding Integrations](./guides/adding-integrations.md)** - Guide for extending toolkits.
- **[Composio Integration](./guides/composio-integrations.md)** - Details on tool execution, connected-account sync, and lifecycle webhooks.
- **[Lead Conversation Summaries](./guides/lead-conversation-summaries.md)** - AI summary generation, persistence, regeneration, security, and operational behavior.
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
*Last updated: June 22, 2026.*
