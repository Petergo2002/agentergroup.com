# Phase 1: UI Structure, Layout, and Static Product Shell

## Objective

Build the full product shell and visual structure of the app without implementing real logic, persistence, authentication, runtime execution, or integrations.

This phase exists so a UI-focused model or designer can build the product surface cleanly before engineering work starts.

## Hard Boundary

Phase 1 is only about:

- App structure
- Layout system
- Navigation
- Static pages
- Static components
- Mock content
- Visual hierarchy
- Empty states
- Placeholder states

Phase 1 is not allowed to include:

- Supabase auth
- Supabase database reads or writes
- Trigger.dev jobs
- Composio connections
- OpenRouter requests
- Agent execution
- Chat logic
- Real React Flow persistence (the library itself is allowed for building the static UI)
- Tool calling
- Background jobs
- API routes
- Server actions
- Business logic

If a page needs data in Phase 1, use hardcoded mock data only.

## Primary Outcome

At the end of Phase 1, the app should feel like a complete product from a UI perspective, even though everything is static underneath.

## Product Structure

The product should be organized into these main routes:

- `/dashboard`
- `/agents`
- `/agents/[id]/builder`
- `/agents/[id]/preview`
- `/connections`
- `/settings`

## Navigation Model

### Main Sidebar

The sidebar should include:

- Dashboard
- Agents
- Connections
- Settings

### Global Top Bar

The top bar should support space for:

- Current page title
- Search or quick jump placeholder
- Workspace switcher placeholder
- User menu placeholder

None of these need real functionality in Phase 1.

## Layout Requirements

### App Shell

The app should use a consistent shell:

- Persistent left sidebar
- Fixed or sticky top bar
- Main content region with clear width rules
- Responsive behavior for desktop and tablet
- Mobile fallback navigation pattern

### Spacing and Rhythm

The layout should feel structured and premium:

- Strong spacing system
- Clear section breaks
- Limited accent usage
- Consistent card, table, and panel spacing

### Visual Direction

The UI should feel:

- Minimal
- Modern
- Product-focused
- Calm
- Clean

Use restrained color usage and rely on typography, spacing, borders, and contrast more than decoration.

## Page Definitions

### Dashboard

Purpose:

- Give a simple overview of the platform

Required sections:

- Header with title and short supporting text
- KPI cards for total agents, connected apps, recent runs, and failures
- Recent agents list
- Recent activity panel
- Empty state for brand new workspaces

All values should be mock values.

### Agents List

Purpose:

- Show all agents in one simple management view

Required sections:

- Header with title and create button
- Filter/search bar placeholder
- Agent list or table
- Status badge
- Short description
- Last edited info
- Empty state when no agents exist

Each agent row should communicate:

- Agent name
- What it does
- Status
- Last updated

### Agent Builder

Purpose:

- Present the canvas editor structure as a dedicated page

Required layout:

- Header bar with agent name, status, and action buttons
- Left panel for node palette
- Center canvas area
- Right panel for selected node configuration

The builder page should look real, but remain static.

Allowed in Phase 1:

- Integrating React Flow (`@xyflow/react`) for the visual canvas
- Hardcoded mock nodes
- Hardcoded mock edges
- Static inspector panel
- Fake tabs such as Overview, Logic, Tools, and Preview

Not allowed in Phase 1:

- Real save behavior
- Real drag-and-drop persistence
- Execution behavior
- Validation rules
- Tool auth
- Runtime state

### Agent Preview

Purpose:

- Show what an agent preview or chat surface will look like

Required sections:

- Agent summary card
- Placeholder chat panel
- Starter prompt chips
- Static right rail for connected tools or context

This page is visual only. No real chat logic.

### Connections

Purpose:

- Reserve a dedicated UI area for connected apps

Required sections:

- Page header
- Connected app cards
- Available app cards
- Status badges
- Empty and loading placeholders

All app states are mock only.

### Settings

Purpose:

- Reserve the base structure for workspace and product settings

Required sections:

- Workspace settings card
- Appearance section
- Security section
- Developer section

All settings controls are presentational only.

## Component Inventory

Phase 1 should define reusable UI components for:

- Sidebar navigation
- Top bar
- Page header
- KPI cards
- Tables
- List rows
- Empty states
- Loading skeletons
- Status badges
- Tabs
- Drawers or side panels
- Form shells
- Builder node cards
- Builder inspector sections

## Builder UI Rules

The builder is a core product surface, so the layout must be deliberate.

Required visual regions:

- Node palette on the left
- Canvas in the center
- Inspector on the right
- Sticky action bar at the top

Suggested mock node types:

- Model
- Prompt
- Tool
- Condition
- Memory
- Approval

These are visual placeholders only in Phase 1.

## Data Policy for Phase 1

Only use mock data.

Recommended mock objects:

- Mock agents
- Mock runs
- Mock connections
- Mock node types
- Mock canvas state

Do not connect mock data to real storage.

## Deliverables

Phase 1 is complete when the repo contains:

- A polished app shell
- Static versions of all core pages
- Reusable UI primitives
- Responsive layout behavior
- A visually convincing builder page
- Clear empty, loading, and populated states

## Acceptance Criteria

- Every core route renders without backend dependencies
- Every page can be reviewed visually with hardcoded data only
- The builder page looks production-ready from a layout perspective
- The dashboard and agents pages communicate the product clearly
- No real auth, runtime, API, or persistence logic exists in this phase

## Gemini Handoff Notes

If Gemini is used to build this phase, the prompt should reinforce:

- Build only UI and layout
- Use mock data only
- Do not add backend logic
- Do not add API calls
- Do not wire Supabase
- Do not wire Trigger.dev
- Do not wire Composio
- Do not wire OpenRouter
- Focus on polish, structure, and consistency
