# End-to-End Integration Guide — Adding New Toolkits

Last updated: 2026-05-20

This document defines the complete workflow for adding a new Composio toolkit (integration) to the Agenter platform. Follow these steps in order to ensure the integration is registered, secured, and properly exposed in the Agent Builder and Runtime.

This guide covers live action toolkits. For external event triggers, also read `docs/guides/automation-agents.md`.

---

## 1. Registry & Environment

### Environment Variables
Add the toolkit version variable to `.env.example`. This allows us to lock tool versions across environments.
- **File:** `.env.example`
- **Pattern:** `COMPOSIO_TOOLKIT_VERSION_<NAME>="latest"`

### Registry Update
Register the new integration in the central registry.
- **File:** `src/lib/integrations.ts`
- **Action:**
  1. Add the slug to `SupportedIntegrationSlug`.
  2. Add a new object to `SUPPORTED_INTEGRATIONS`.
- **Properties:**
  - `slug`: The Composio toolkit slug (lowercase).
  - `displayName`: Human-readable name.
  - `icon`: Material Symbols icon name.
  - `simpleIcon`: The `si<Brand>` key from `SimpleIcon.tsx`.
  - `simpleIconColor`: Brand hex code.
  - `recommendedChatTools`: Small default action set shown under **Recommended** in the builder (e.g., `GMAIL_SEND_EMAIL`).
  - `surface`: `"chat"` (tools used during conversation) or `"knowledge"` (tools used for importing data).

Do not add a platform-level chat allow list for new Composio toolkits. Chat integrations should expose the toolkit's available Composio actions through `/api/connections/toolkits/[toolkitSlug]/tools`, then store the user's selected action slugs in the builder node as `enabledTools`.

---

## 2. Core Logic & Security

### Toolkit Mapping
Update the default version mapping.
- **File:** `src/lib/composio.ts`
- **Action:** Add the slug to `DEFAULT_COMPOSIO_TOOLKIT_VERSIONS` using the environment variable.

### Auth Configuration
Check whether the Composio toolkit has a managed auth config available.

- **Managed auth available:** no extra env is needed; `createConnectionRequest()` can create `use_composio_managed_auth`.
- **Managed auth not available:** add explicit env support for either a pre-created auth config id or provider credentials, then branch `createConnectionRequest()` to use `use_custom_auth`.

Shopify is the reference implementation for custom auth:

- `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID` or `COMPOSIO_AUTH_CONFIG_SHOPIFY` can point at a real Composio auth config id.
- Otherwise `COMPOSIO_SHOPIFY_CLIENT_ID`, `COMPOSIO_SHOPIFY_CLIENT_SECRET`, and `COMPOSIO_SHOPIFY_OAUTH_REDIRECT_URI` are used to create a Shopify `use_custom_auth` OAuth2 config.
- Never document placeholders such as `ac_...` as usable values; they are examples only.

### Tool Constants
Define constants for the tools you'll be intercepting or using.
- **File:** `src/lib/composio.ts`
- **Action:** `const <NAME>_TOOL = "<COMPOSIO_UPPERCASE_NAME>";`
- **Use only when needed:** Constants are required for policy interception, argument patching, or response masking. They are not the source of available actions.

### Action Discovery
Expose the full action list for the toolkit.
- **File:** `src/lib/integrations.ts`
- **Action:** Add the toolkit's Composio tool-name prefix in `getToolNamePrefixForToolkit()`.
- **File:** `src/lib/composio.ts`
- **Action:** Reuse `listToolkitChatActions()` to fetch all Composio tools for the toolkit and mark `recommendedChatTools` as recommended.
- **File:** `src/app/api/connections/toolkits/[toolkitSlug]/tools/route.ts`
- **Action:** This route should work for every `surface: "chat"` integration once the toolkit is registered and has a prefix.

### Security Policies
If the toolkit involves sensitive actions (like sending emails), you must apply interception logic.
- **File:** `src/lib/composio.ts`
- **Actions:**
  - Update `applyEmailRecipientPolicyToCompletion` to intercept tool calls and enforce restrictions (e.g., stripping CC/BCC, forcing recipients).
  - Update `sanitizeEmailToolMessages` to mask tool outputs in the conversation history when a security policy is active.

### Policy Extraction
Ensure the system can detect the node on the canvas and extract its security settings.
- **File:** `src/lib/gmail.ts` (or a more generic policy helper)
- **Action:** Update `extractGmailRecipientPolicyFromNodes` to look for your new node kind.

---

## 3. Types & Enums

### Builder Enums
Add the node kind to the union type.
- **File:** `src/lib/types/enums.ts`
- **Action:** Add the slug to `BuilderNodeKind`.

### Builder Data Structures
Define the data shape for the builder node.
- **File:** `src/lib/types/builder.ts`
- **Action:** 
  1. Create `<Name>BuilderNodeData` interface (usually extending `BaseBuilderNodeData`).
  2. Add the new interface to the `BuilderNodeData` union.

---

## 4. Agent Builder (UI)

### Node Registry
- **File:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **Action:** Add the slug to `ToolNodeKind` and `TOOL_NODE_KINDS`.

### Constants & Positions
- **File:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **Action:** Add a default position to `DEFAULT_POSITIONS`.

### Helper Functions
Update the following functions in `src/app/(app)/agents/[id]/builder/page.tsx`:
- `getBuilderNodeText`: Add localized labels and descriptions.
- `formatToolActionName` and `getEnabledToolNames`: Keep action labels generic; the builder should render the toolkit's Composio actions dynamically.
- `isToolNodeKind` & `isBuilderNodeKind`: Add the new kind.
- `buildEdges`: Add logic to draw the edge from Agent Core to the new node.
- `inferNodeKind`: Add logic to detect the node kind from raw database labels.

### Node Creation & Normalization
- **File:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **Action:**
  1. Implement `create<Name>Node()` helper.
  2. Initialize `enabledTools` with `getRecommendedChatToolsForToolkit("<slug>")`.
  3. Update `normalizeDefinition()` to restore existing `enabledTools`; when absent, fall back to `recommendedChatTools` so old drafts keep working.

### Sidebar Inspector (JSX)
Update the `renderInspectorBody()` function in the `AgentBuilderPage` component.
- **File:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **Action:**
  - Update variable assignments (e.g., `emailRecipientEmail`).
  - Add JSX for the specific settings (inputs, selects, etc.) required by the toolkit.
  - Keep the **Enabled Actions** editor available for the toolkit node. Recommended actions should be one-click defaults; more actions should come from Composio and be user-enabled explicitly.
  - Update the "Remove Node" button logic.

---

## 5. Runtime & LLM Guidance

### Runtime Logic
- **File:** `src/lib/runtime/agent-chat.ts`
- **Action:**
  - Update `buildToolGuidance()` to include specific system prompts/instructions for the new toolkit. This tells the LLM *how* and *when* to use these tools.
  - Update the `enabledToolkits` filter logic if the toolkit should be hidden when certain security conditions aren't met.
- **File:** `src/lib/tool-actions.ts`
- **Action:** Runtime action selection is extracted from the saved builder definition. The stored `enabledTools` are validated against the toolkit prefix before `getWrappedTools()` loads them from Composio.
- **File:** `src/lib/composio.ts`
- **Action:** `getWrappedTools()` receives `enabledToolsByToolkit`. If a node has no stored `enabledTools`, it falls back to `recommendedChatTools` for backward compatibility.

### Automation Runtime

Automation agents use the same `runAgentChat(...)` runtime as chat agents.

If the new toolkit should be usable inside automations:

- make sure the node syncs its selected `connectionId` into `agent_connections`
- make sure `extractEnabledToolsFromDefinition()` can recognize the node and validate its `enabledTools`
- make sure any policy extractor used by chat also works from the saved draft definition
- update `src/lib/automation/executor.ts` if the toolkit has additional per-node runtime settings that must be passed into `runAgentChat(...)`
- update `docs/guides/automation-agents.md`
- update `docs/guides/composio-integrations.md` with auth setup, default tools, and known response-shape notes

Automation does not automatically grant all tools for a toolkit. Only attached/selected tool nodes are loaded.

---

## 5B. Adding External Trigger Types

External trigger support is separate from live action tools.

Automation v1 currently supports only:

- provider: `composio`
- toolkit: `gmail`
- trigger slug: `GMAIL_NEW_GMAIL_MESSAGE`

To add a new external trigger such as Slack message or calendar event:

1. Loosen the database constraints on `agent_automations.toolkit_slug` and `agent_automations.trigger_slug`.
2. Add a typed trigger source in `src/lib/types/builder.ts`.
3. Add default trigger config in `src/lib/agents/defaults.ts` if it should be selectable on creation.
4. Add trigger option UI in `src/app/(app)/agents/[id]/builder/page.tsx`.
5. Update `PUT /api/agents/[id]/automation` validation to accept the new trigger.
6. Update `POST /api/agents/[id]/automation/status` to validate the right connected account/toolkit.
7. Update `POST /api/composio/webhook` if event matching or payload normalization differs from Gmail.
8. Update Activity/readiness copy where provider-specific labels are shown.
9. Update `docs/guides/automation-agents.md`.

Keep product language generic. The top-level feature remains `Automation`; only the trigger option should say `Gmail`, `Slack`, `Calendar`, or another provider name.

---

## 6. Visuals & Translations

### Icons
- **File:** `src/components/icons/SimpleIcon.tsx`
- **Action:** Add the SVG path for the brand to `SIMPLE_ICON_PATHS` using the `si<Name>` key. Use standard [Simple Icons](https://simpleicons.org/) geometry when possible.

### Translations
- **File:** `src/locales/en/agentBuilder.ts`
- **Action:**
  - Add `<name>Description`.
  - Add `use<Name>` guidance text.
  - Update `nodeLibrary.toolsDescription` to mention the new brand.

---

## 7. Verification Checklist

- [ ] **Connections Page:** Does the brand appear? Can you connect/reconnect?
- [ ] **Agent Builder:** Can you add the node? Does it connect to the Agent Core?
- [ ] **Sidebar Settings:** Can you configure the tool? Do settings save/persist?
- [ ] **Runtime Chat:** Does the LLM recognize the tool? Does it follow the guidance?
- [ ] **Security:** If using restricted modes (e.g., Specific Email), are parameters correctly stripped?
- [ ] **Visuals:** Does the icon look correct in both the Sidebar and the Node?
