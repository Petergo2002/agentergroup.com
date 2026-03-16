# Phase 2: Conversational Agent MVP

## Objective

Build the first real product version as a focused conversational agent platform.

Phase 2 should make one thing work well:

- A user can open an agent
- Chat with it in real time
- Let it answer from a knowledge base
- Let it use connected tools during the current conversation

This phase is intentionally narrow.

It is not about full workflow automation.

## Product Positioning

The Phase 2 product should be understood as:

- An AI agent that can answer using your knowledge base
- An AI agent that can take actions using connected tools inside the current conversation

That is the MVP.

## Primary Outcome

At the end of Phase 2, a signed-in user should be able to:

- Create an agent
- Connect apps through Composio
- Attach a knowledge base to the agent
- Chat with the agent
- See the agent retrieve knowledge and call tools during the conversation

## Stack Decisions

- Supabase for auth
- Supabase for database
- OpenRouter for model access
- Composio for tool connectivity
- React Flow only as a configuration UI
- Trigger.dev deferred for later phases unless a very small async need appears

## Core Product Rule

Phase 2 only supports actions that happen inside the current conversation.

Allowed examples:

- Answer a question from the knowledge base
- Look up a customer in a connected tool
- Book a meeting during the current chat
- Draft a reply using retrieved context

Not allowed in Phase 2:

- Multi-step workflows after the chat ends
- Scheduled runs
- Background agents
- Complex branching logic
- Autonomous follow-up sequences
- Approval chains
- Long-running orchestration

If a feature is not required for the live conversation, it should not be in Phase 2.

## Scope

### 1. Authentication and Workspace

Implement:

- Supabase auth
- User sessions
- One workspace model
- Basic ownership and membership rules

Keep this simple. No advanced team management yet.

### 2. Agent Configuration

Implement:

- Agent create flow
- Agent edit flow
- Agent name
- Agent description
- Agent instructions
- Agent model
- Starter prompts
- Allowed tools
- Linked knowledge sources
- Draft and published state if needed, but keep versioning lightweight

The agent should feel configurable, but not over-engineered.

### 3. Knowledge Base

This is a core Phase 2 requirement.

Implement:

- Knowledge source records
- Document upload or text/URL ingestion
- Chunking and embedding pipeline
- Retrieval at chat time
- Source references in answers when relevant

The MVP value is heavily tied to the agent being able to answer from context, not just from the model.

### 4. Connections and Tools

Implement the first real Composio layer:

- Show available apps
- Start connection flow
- Show connected accounts
- Show connection status
- Attach allowed tools to a specific agent

Keep the supported toolkit list small at first.

Phase 2 should optimize for:

- Clarity
- Reliability
- Controlled tool access

Not breadth.

### 5. Chat Runtime

Implement a first working conversational runtime:

- User opens an agent
- User starts or resumes a thread
- User sends a message
- The system retrieves relevant knowledge
- The model decides whether to answer directly or use a tool
- Tool calls happen during the current conversation
- The final answer is returned in chat
- Messages and runs are stored

This runtime should be synchronous and chat-first.

### 6. Builder and Configuration UI

The builder should remain useful, but it must reflect the MVP.

The builder should use a very small surface area:

- A fixed `Trigger` start node to represent the incoming user message
- A fixed core `Agent` node that always sits at the center of the conversation flow
- `Knowledge` nodes for retrieval sources
- `Tools` nodes for allowed connected actions
- A separate preview page for testing the live chat experience

The core `Agent` node is the most important node in the builder.

It should always exist by default and represent:

- The selected model
- The main instructions
- The active conversation context
- The decision to answer directly, retrieve knowledge, or use a tool

The detailed agent setup should live in the right-side setup panel, not in a complex workflow graph.

The setup panel should own:

- Agent name
- Model
- Instructions
- Starter prompts
- Basic description

Do not add separate workflow-style nodes for those items.

Do not let the builder imply that Phase 2 already supports:

- Branching flows
- Conditions
- Workflow graphs
- Scheduling
- Approval steps
- Background execution

React Flow can remain as the editing surface, but the mental model should be configuration, not orchestration.

## Recommended Phase 2 Limits

To keep the MVP sharp:

- One main agent type
- One live conversation model
- Small set of supported Composio apps
- Small set of knowledge source types
- Manual chat initiation only
- Fixed trigger entry point
- Very small node library
- No hidden automation after a conversation
- No workflow engine
- No condition engine
- No trigger system as a core user-facing feature

## Non-Goals

Phase 2 should explicitly avoid:

- Trigger.dev workflows as a major feature
- Post-conversation automations
- Async orchestration pipelines
- Lead routing workflows
- Sales or support automations with branches
- Human approval systems
- Agent-to-agent systems
- Marketplace features
- Billing
- Deep analytics
- Enterprise permissions complexity

These belong later, after the conversational core is solid.

## Deliverables

- Working Supabase auth
- Working database schema
- Real agent CRUD
- Real knowledge base storage and retrieval
- Real Composio connection flow
- Real in-conversation tool calling
- Working chat threads
- Stored messages and runs
- Builder/config UI aligned to the MVP

## Acceptance Criteria

- A user can sign in and access a workspace
- A user can create and edit an agent
- A user can attach knowledge to an agent
- A user can connect at least one external app
- A user can chat with the agent in real time
- The agent can answer using retrieved knowledge
- The agent can call connected tools during the chat
- Messages, runs, and core agent records are stored in Supabase
- No post-chat workflow behavior is required for the product to be considered complete

## Engineering Notes

- Treat React Flow as an editor, not the runtime
- Execute a normalized server-side agent definition, not raw UI graph state
- Keep tool permissions explicit per agent
- Keep retrieval and tool use transparent in the chat experience
- Favor a simple synchronous request-response loop before adding jobs or orchestration
- Do not introduce Trigger.dev just because it exists in the stack

## Simple Decision Filter

Before adding a feature, ask:

- Does this help the agent during the current conversation?

If the answer is no, it should move to a later phase.
