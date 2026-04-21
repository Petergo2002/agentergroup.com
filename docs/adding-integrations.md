# End-to-End Integration Guide — Adding New Toolkits

Last updated: 2026-04-19

This document defines the complete workflow for adding a new Composio toolkit (integration) to the Agenter platform. Follow these steps in order to ensure the integration is registered, secured, and properly exposed in the Agent Builder and Runtime.

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
  - `allowedChatTools`: Array of specific tool names (e.g., `GMAIL_SEND_EMAIL`).
  - `surface`: `"chat"` (tools used during conversation) or `"knowledge"` (tools used for importing data).

---

## 2. Core Logic & Security

### Toolkit Mapping
Update the default version mapping.
- **File:** `src/lib/composio.ts`
- **Action:** Add the slug to `DEFAULT_COMPOSIO_TOOLKIT_VERSIONS` using the environment variable.

### Tool Constants
Define constants for the tools you'll be intercepting or using.
- **File:** `src/lib/composio.ts`
- **Action:** `const <NAME>_TOOL = "<COMPOSIO_UPPERCASE_NAME>";`

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
- `getToolActionLabels`: Define which actions appear in the "Allowed Actions" badge.
- `isToolNodeKind` & `isBuilderNodeKind`: Add the new kind.
- `buildEdges`: Add logic to draw the edge from Agent Core to the new node.
- `inferNodeKind`: Add logic to detect the node kind from raw database labels.

### Node Creation & Normalization
- **File:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **Action:**
  1. Implement `create<Name>Node()` helper.
  2. Update `normalizeDefinition()` to correctly restore the node from the database.

### Sidebar Inspector (JSX)
Update the `renderInspectorBody()` function in the `AgentBuilderPage` component.
- **File:** `src/app/(app)/agents/[id]/builder/page.tsx`
- **Action:**
  - Update variable assignments (e.g., `emailRecipientEmail`).
  - Add JSX for the specific settings (inputs, selects, etc.) required by the toolkit.
  - Update the "Remove Node" button logic.

---

## 5. Runtime & LLM Guidance

### Runtime Logic
- **File:** `src/lib/runtime/agent-chat.ts`
- **Action:**
  - Update `buildToolGuidance()` to include specific system prompts/instructions for the new toolkit. This tells the LLM *how* and *when* to use these tools.
  - Update the `enabledToolkits` filter logic if the toolkit should be hidden when certain security conditions aren't met.

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
