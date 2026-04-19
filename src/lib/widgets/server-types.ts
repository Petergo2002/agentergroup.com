import type {
  AgentRecord,
  BuilderDefinition,
  WidgetDraftPreviewInput,
  WidgetPreviewDraftRecord,
  WidgetSessionRecord,
} from "@/lib/types";

export interface WidgetQueryResult<TData> {
  data?: TData | null;
  error?: { message: string } | null;
}

export interface WidgetRpcQueryResult<TData> {
  data?: TData | null;
  error?: { message: string } | null;
}

export interface WidgetSelectBuilder<TData> {
  eq: (column: string, value: string) => WidgetSelectBuilder<TData>;
  maybeSingle: () => Promise<WidgetQueryResult<TData>>;
}

export interface WidgetLimitSelectBuilder<TData> {
  limit: (count: number) => Promise<WidgetQueryResult<TData>>;
}

export interface WidgetOrderedSelectBuilder<TData> extends WidgetSelectBuilder<TData> {
  eq: (column: string, value: string) => WidgetOrderedSelectBuilder<TData>;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => WidgetLimitSelectBuilder<TData[]>;
}

export interface WidgetInSelectBuilder<TData> {
  in: (column: string, values: string[]) => Promise<WidgetQueryResult<TData[]>>;
}

export interface WidgetOrderedInSelectBuilder<TData> extends WidgetOrderedSelectBuilder<TData> {
  in: (column: string, values: string[]) => Promise<WidgetQueryResult<TData[]>>;
}

export interface WidgetMutationBuilder<TData> extends PromiseLike<WidgetQueryResult<TData>> {
  select: (columns?: string) => {
    single: () => Promise<WidgetQueryResult<TData>>;
  };
}

export interface WidgetUpdateBuilder<TData> {
  eq: (column: string, value: string) => Promise<WidgetQueryResult<TData>>;
}

export interface WidgetTableQuery {
  select: <TData = unknown>(columns?: string) => WidgetOrderedInSelectBuilder<TData>;
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string },
  ) => WidgetMutationBuilder<unknown>;
  insert: (
    values: Record<string, unknown> | Record<string, unknown>[],
  ) => WidgetMutationBuilder<unknown>;
  update: (values: Record<string, unknown>) => WidgetUpdateBuilder<unknown>;
}

export interface WidgetAdminSupabase {
  from: (table: string) => WidgetTableQuery;
  rpc: <TData = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<WidgetRpcQueryResult<TData>>;
}

export interface WidgetPreviewDraftRow extends WidgetPreviewDraftRecord {
  payload: WidgetDraftPreviewInput;
}

export interface AgentDraftDefinitionRow {
  agent_id: string;
  definition: BuilderDefinition | null;
}

export interface AgentVersionDefinitionRow {
  id: string;
  definition: BuilderDefinition | null;
}

export interface WidgetPreviewTokenPayload {
  widgetPublicKey: string;
  widgetId: string;
  workspaceId: string;
  userId: string;
  revision?: string;
  expiresAt: number;
  issuedAt: number;
}

export interface WidgetAccessTokenPayload {
  widgetPublicKey: string;
  widgetId: string;
  source: "embedded" | "hosted";
  allowedOrigin: string | null;
  issuedAt: number;
  expiresAt: number;
}

export interface RuntimeWidgetAgentSelection {
  widgetAgentId: string;
  persistedWidgetAgentId: string | null;
  publishedVersionId: string | null;
  agent: AgentRecord;
}

export interface WidgetSessionTurnLockRow {
  widget_session_id: string | null;
  status: WidgetSessionRecord["status"] | null;
  active_turn_request_id: string | null;
  active_turn_started_at: string | null;
  acquired: boolean;
}

export const WIDGET_PREVIEW_TTL_MS = 15 * 60 * 1000;
export const WIDGET_ACCESS_TTL_MS = 15 * 60 * 1000;
export const WIDGET_ACTIVE_TURN_STALE_MS = 10 * 60 * 1000;
export const DEPLOY_TIMESTAMP_SKEW_MS = 2000;