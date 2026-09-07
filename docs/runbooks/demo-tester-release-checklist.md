# Demo Tester Release Checklist

Last updated: August 25, 2026

## Reminder

> Do not invite demo testers until every item in **Required Before Testers** is complete and verified from a clean release build.

Agentergroup is ready to be offered as a small, managed pilot. It is not yet ready for an unattended self-service launch. The immediate priority is proving the complete customer journey, monitoring reliability and cost, and making onboarding easy—not adding more product features.

## Recommended Release Model

- Start with 5–10 carefully selected businesses in one niche.
- Use concierge onboarding and manual plan activation.
- Run a 14–30 day pilot.
- Keep the current prices as pilot prices until real cost and outcome data is available.
- Do not market Automation Agents, Internal Assistants, Agent Sites, voice, or other gated/roadmap capabilities as core pilot features.

## Required Before Testers

### 1. Create a clean release

- [ ] Commit all intended Milo, Website Chat, documentation, migration, and widget changes.
- [ ] Ensure no required migration or application file is left untracked.
- [ ] Review the release diff and remove accidental files.
- [ ] Run CI from a clean checkout.
- [ ] Create a named release commit or tag that can be rolled back.
- [ ] Confirm the dashboard and Widget V2 release versions belong together.

### 2. Prove the complete staging journey

- [ ] Register a new customer account.
- [ ] Verify legal consent is recorded.
- [ ] Activate the workspace from Admin.
- [ ] Add text, file, and website Knowledge.
- [ ] Configure and save Milo.
- [ ] Preview Milo and verify Knowledge-backed answers.
- [ ] Configure Website Chat appearance and behavior.
- [ ] Publish Website Chat.
- [ ] Test its hosted link.
- [ ] Test the real embed loader on a separate test website.
- [ ] Complete a visitor conversation.
- [ ] Capture a lead and confirm it appears in Leads.
- [ ] Confirm the conversation appears in Analytics.
- [ ] Verify lead-summary generation and regeneration.
- [ ] Generate an unanswered question and resolve it through Improve Milo.
- [ ] Connect one real provider account and perform one safe action.
- [ ] Repeat tenancy checks with two users in different workspaces.
- [ ] Verify member, admin, and owner permissions.
- [ ] Test the main journey on desktop and mobile.

### 3. Add monitoring and alerts

- [ ] Add server and browser error reporting.
- [ ] Monitor `/api/health` from an external uptime service.
- [ ] Alert on elevated API 5xx responses.
- [ ] Alert on OpenRouter failures and abnormal latency.
- [ ] Alert on Widget bootstrap, chat, upload, and streaming failures.
- [ ] Alert on Supabase Edge Function failures.
- [ ] Alert on Composio webhook and external-action failures.
- [ ] Alert on Stripe webhook failures or `requires_review` events.
- [ ] Remove expected authentication redirects from error noise.
- [ ] Document who receives alerts and what they should do.

### 4. Complete production configuration and operations

- [ ] Configure a dedicated `GDPR_RETENTION_CRON_SECRET`.
- [ ] Configure a dedicated `LEGAL_CONSENT_SECRET`.
- [ ] Configure the public dashboard and Widget V2 URLs.
- [ ] Schedule and verify the daily privacy-retention job.
- [ ] Confirm a recent production backup.
- [ ] Complete a restore test in a non-production project.
- [ ] Confirm all 96 migrations match the target project before deployment.
- [ ] Run Supabase security and performance advisors after deployment.
- [ ] Resolve the legacy Widget attachment inventory decision.
- [ ] Verify Composio lifecycle webhook subscriptions.
- [ ] Verify the knowledge Edge Function source matches the repository.
- [ ] Document secret rotation and provider recovery procedures.

### 5. Track cost and usage

- [ ] Record model name for every AI operation.
- [ ] Record input, output, and total tokens where the provider exposes them.
- [ ] Estimate OpenRouter cost per operation and workspace.
- [ ] Track Firecrawl and Composio usage that creates variable cost.
- [ ] Report cost per conversation, lead, and completed external action.
- [ ] Add internal workspace budget warnings.
- [ ] Check pilot pricing against observed cost and support time.

### 6. Prepare tester onboarding and support

- [ ] Create a one-page “Get Milo live” checklist.
- [ ] Prepare a sample Knowledge pack for the selected niche.
- [ ] Prepare one proven Milo instruction set for that niche.
- [ ] Create embed instructions for common website platforms.
- [ ] Give testers a test-question and acceptance checklist.
- [ ] Add a visible support/contact path inside the product.
- [ ] State the expected activation time on the pending screen.
- [ ] State the expected support response time.
- [ ] Create a feedback form and a place to report bugs.
- [ ] Prepare a demo workspace with realistic, non-sensitive sample data.

### 7. Finish customer-facing polish

- [ ] Rewrite login/signup copy around the product outcome: answer questions, capture leads, and book or trigger the next step.
- [ ] Standardize `Agentergroup`, Milo, logos, capitalization, and product names.
- [ ] Remove classic Agent/Widget terminology from Milo-mode empty states.
- [ ] Remove the “Internal Leads node” instruction from Milo-mode Leads copy.
- [ ] Fix duplicated brand text in legal page browser titles.
- [ ] Align documentation with the actual authentication behavior of compliance routes.
- [ ] Update hardcoded dashboard, widget, privacy, and branding URLs when the new domain is selected.
- [ ] Run keyboard, focus, contrast, mobile, and automated accessibility checks on authenticated screens.

## Required Before Accepting Paid Customers

- [ ] Have a qualified lawyer review the Terms, Privacy Policy, DPA, subprocessors, company/entity details, jurisdiction, liability, termination, refunds, and international transfers.
- [ ] Define the exact services included in each pilot plan.
- [ ] Define what counts as a message credit and which background AI operations consume credits.
- [ ] Define support scope and response expectations for each plan.
- [ ] Confirm pricing covers provider cost, support time, and payment fees.
- [ ] Decide how failed AI calls and failed external actions affect customer credits.
- [ ] Provide a clear cancellation and data-export process.
- [ ] Create a basic incident-communication template.
- [ ] Make Builder saving transactional, or add reliable partial-save detection and recovery.

## Required Before Self-Service Launch

- [ ] Add a public marketing and pricing journey.
- [ ] Replace manual activation with a tested self-service onboarding decision.
- [ ] Complete Stripe checkout, portal, invoice, renewal, cancellation, and webhook testing.
- [ ] Add automated browser tests for the critical customer journeys.
- [ ] Decide on an application-wide Origin/CSRF protection model.
- [ ] Enable stronger password requirements and review leaked-password protection.
- [ ] Add scalable support documentation or a help center.
- [ ] Add production real-user monitoring for navigation, LCP, INP, and chat time-to-first-token.
- [ ] Replace broad Admin application-side aggregation before unrestricted scale.

## Pilot Success Metrics

Measure these for every tester:

- Time from activation to published Website Chat.
- Setup completion rate.
- Number of visitor conversations.
- Useful-answer rate.
- Unanswered-question rate.
- Leads captured.
- Meetings or follow-ups generated.
- Successful and failed external actions.
- Cost per workspace and conversation.
- Weekly support time per customer.
- Tester satisfaction and willingness to pay.

## Stop Conditions

Pause the affected workspace or pilot immediately if any of these occur:

- Cross-workspace data exposure.
- Lost or incorrectly attributed leads, messages, or Knowledge.
- An external action occurs without clear authorization.
- Milo repeatedly invents important business facts.
- Provider cost rises unexpectedly or cannot be explained.
- A critical provider failure cannot be detected or communicated.
- Privacy deletion or export produces incomplete or cross-tenant results.

## Deliberately Deferred

These should not delay the managed pilot:

- Voice mode.
- Native Agent Sites.
- Custom domains.
- Additional agent types.
- More integrations.
- Template marketplace expansion.
- Full self-service billing.
- Large-scale Admin optimizations.

## Final Go/No-Go

The pilot is **GO** only when:

- [ ] The release is clean, reproducible, and rollback-ready.
- [ ] The complete staging journey has passed twice.
- [ ] Cross-tenant isolation has been verified with real users.
- [ ] Monitoring and an operator response path are active.
- [ ] Retention, backups, and provider webhooks are verified.
- [ ] Testers have onboarding, support, and feedback instructions.
- [ ] The pilot owner explicitly accepts the documented remaining risks.
