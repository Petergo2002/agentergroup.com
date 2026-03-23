# Phase 4: Agent Deployment and Chat Widget

Status note:

- This document started as a phase-direction doc.
- Parts of the product direction here are now historical.
- Current implementation has moved widget management to `/widgets`, ships the widget runtime in this repo, supports multi-agent widgets, and uses a mixed deployment model where live chat is version-snapshotted but widget config remains live until redeployed.

## Objective

Turn the current product into something that can actually be deployed and used by anyone who wants an agent on a website.

This phase should move the platform from:

- build and preview

to:

- build
- preview
- publish
- deploy

The product direction for this phase is closer to a Shopify-style approach than a pure agency-first approach.

That means:

- the platform should be simple enough for anyone to create and launch an agent
- agencies can still use it
- later, developers, partners, and agencies can build on top of it with templates, themes, and extensions

## Important Status Update

Workspace is now considered done enough for this phase.

The platform already has the right base:

- multiple workspaces
- active workspace switching
- workspace creation
- workspace deletion
- workspace-scoped agents, knowledge, connections, chats, and runs

That remains important and should stay, but it is not the main focus of the next build step.

## New Product Direction

The platform should now be understood as:

- a simple product for creating and deploying AI agents

Not primarily:

- an internal agency operations tool

Agencies are still a strong customer type.
But the product should not be limited by agency positioning.

The stronger long-term model is:

- self-serve core first
- deployable agents
- later:
  - templates
  - themes
  - developer ecosystem
  - agency and partner layer

## Primary Outcome

At the end of Phase 4, a user should be able to:

1. create an agent
2. configure it
3. preview it
4. open widget management from the main product, optionally seeded from an agent context
5. deploy that agent as a chat widget
6. either:
   - embed it on a website
   - or use a direct hosted widget link

If that flow works, the product becomes much closer to a real Shopify-style agent platform.

## Core Product Rule

This phase is about deployment and distribution of agents.

It is not about:

- more workflow automation
- more node types
- more backend orchestration complexity
- white-label SaaS
- billing
- theme marketplace yet

The only thing that matters in this phase is:

- make agents launchable

## Scope

### 1. Add Widget As A First-Class Part Of The Agent

The widget should live on the agent itself, not as a disconnected product area.

That means:

- if a user is inside:
  - `/agents/[id]/builder`
- the builder should include a widget/deployment tab

This is the correct place for it because deployment is part of the lifecycle of one specific agent.

The user mental model should be:

- build the agent
- preview the agent
- deploy the agent

Not:

- build the agent here
- then go somewhere unrelated to figure out deployment

## 2. Builder-Level Tab Structure

The builder should evolve to have clear sections or tabs for the same agent.

Recommended structure:

- `Builder`
- `Preview`
- `Widget`

Where:

- `Builder` is the current agent setup/editor
- `Preview` is the live testing surface
- `Widget` is the deployment surface

This keeps the experience centered around one agent object.

## 3. Widget Tab Responsibilities

The widget management surface should be the place where deployment is configured.

It should handle:

- widget status
- publish/deploy state
- install method
- embed snippet or deployment payload
- hosted widget link
- basic widget identity settings

The first version did stay simple, but the current implementation now supports multi-agent widgets through `widget_agents`.

## 4. Widget Runtime Integration

The current implementation no longer treats the widget runtime as an external repo dependency.

This repo now contains both:

- the internal control plane
- the hosted and embeddable widget runtime in `apps/widget-v2`

### This repo should own:

- widget configuration UI
- linking an agent to a widget deployment
- publish/deploy controls
- embed instructions
- hosted link generation logic or hosted link metadata
- rendered chat widget UI
- embed runtime
- hosted widget frontend experience

The responsibility split is now internal-to-the-monorepo rather than split across two repos.

## 5. Supported Deployment Modes

Phase 4 should support two widget outputs:

### Embedded widget

For websites where the user wants to place a script or embed snippet on their own site.

### Hosted widget link

For users who want a shareable standalone URL to the agent widget.

This is important because not every user will deploy immediately into a full website.

## 6. Deployment Flow

The intended user flow should now be:

1. Create agent
2. Configure instructions, knowledge, and tools
3. Preview and test
4. Open widget management in `/widgets` (often seeded from an agent context)
5. Publish or confirm publish state
6. Generate widget deployment
7. Choose:
   - embed on site
   - use hosted widget link

That should be the clean path.

## 7. Agent Publish Relationship

Deployment should be attached to a real agent state.

For this phase, the simplest correct rule is:

- live widget chat uses the published version snapshot stored into each deployed `widget_agent`

That avoids confusion.

The widget should not silently run some random draft state.

Important current nuance:

- chat execution is version-snapshotted at deploy time
- widget branding, access settings, and other config still come from current widget rows
- redeploy is therefore required when config drifts from the last deployment event

So the widget management surface should make publish state obvious:

- not published
- published
- needs redeploy if changed later

## 8. Keep Workspaces But Reframe Them

Workspace is still important.

But the product copy and mental model should now be broader:

- a workspace can represent a project, business, brand, or client

Not only:

- an agency client container

This keeps the architecture useful while broadening the product positioning.

## 9. What This Phase Must Include

- widget management surface in the product
- connection between agents and widget deployment
- in-repo widget runtime
- embedded install path
- hosted widget link path
- publish-to-deploy relationship
- simple deployment UX

## 10. What This Phase Should Not Include

Do not expand the scope with:

- billing
- agency invoicing
- customer billing
- white-label dashboard
- widget theme marketplace
- public extensions marketplace
- advanced branding engine
- complex analytics suite
- advanced multi-widget routing

Those can come later.

## 11. Why This Direction Is Better

This direction is stronger because it makes the product:

- simpler to understand
- easier to try
- easier to sell
- easier to grow into a broader platform

It also keeps agencies inside the target market without making agencies the only story.

That is much closer to a Shopify-style platform model.

## Suggested Deliverables

### Agent UI

- agent-level tabs or segmented navigation
- builder remains the editor
- preview remains the testing surface
- widget becomes the deployment surface

### Widget deployment surface

- deployment status UI
- hosted widget link
- embed snippet or install instructions
- published version linkage
- preview drafting and preview access tokens
- hosted access toggle
- multi-agent widget configuration

### Runtime integration

- keep the widget runtime in `apps/widget-v2`
- define the config and access-token handoff between the Next.js app and the widget runtime
- support bootstrap, config, chat, lead, event, and session-complete flows

### Product clarity

- deployment language centered around agents
- less agency-only wording
- more self-serve wording

## Acceptance Criteria

Phase 4 is complete when:

- the user can manage widgets from the main product
- widget management can still be seeded from an agent context
- the widget can be deployed using the in-repo widget runtime
- the user can either embed the widget or use a hosted link
- deployment uses the published agent state, not a hidden draft
- the whole flow feels like one product journey: build, preview, deploy

## Non-Goals

Phase 4 should not try to solve:

- white-label productization
- partner revenue systems
- marketplace mechanics
- deep customization systems
- advanced org structures
- post-chat automation

## Simple Decision Filter

When deciding whether a feature belongs in this phase, use this filter:

- Does it directly help a user launch an agent as a website chat widget?

If yes, it likely belongs in Phase 4.

If not, it probably belongs later.

## Phase 4 Summary

Workspace is now the foundation.

The next real product step is:

- widget deployment inside the agent flow

The product should now move toward:

- create agent
- configure agent
- preview agent
- deploy agent

That is the correct next phase.
