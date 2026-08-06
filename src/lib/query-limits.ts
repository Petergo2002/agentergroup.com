/**
 * Defensive upper bounds for server-rendered workspace lists. These are set
 * above current plan limits and prevent accidental unbounded response growth.
 */
export const WORKSPACE_AGENT_LIST_LIMIT = 250;
export const WORKSPACE_WIDGET_LIST_LIMIT = 250;
export const WORKSPACE_CONNECTION_LIST_LIMIT = 100;
export const WORKSPACE_KNOWLEDGE_SOURCE_LIST_LIMIT = 500;
export const WORKSPACE_KNOWLEDGE_FOLDER_LIST_LIMIT = 250;
export const BUILDER_VERSION_LIST_LIMIT = 100;
export const WORKSPACE_ASSISTANT_LIST_LIMIT = 100;
