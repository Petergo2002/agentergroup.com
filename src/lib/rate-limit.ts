import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { getRateLimitSecret } from "@/lib/env";
import { resolveTrustedClientIp } from "@/lib/trusted-client-ip";

interface RateLimitRpcResult {
  allowed?: boolean | null;
  hit_count?: number | null;
  limit_value?: number | null;
  remaining?: number | null;
  retry_after_seconds?: number | null;
  window_started_at?: string | null;
  expires_at?: string | null;
}

interface RateLimitRpcClient {
  rpc: <TData = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data?: TData | null; error?: { message: string } | null }>;
}

export type PublicWidgetRateLimitEndpoint =
  | "chat"
  | "events"
  | "complete"
  | "leads";

export interface RateLimitRule {
  endpoint: string;
  scopeKind: string;
  scopeKey: string;
  windowSeconds: number;
  limit: number;
  code: string;
  message: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  endpoint: string | null;
  scopeKind: string | null;
  code: string | null;
  message: string | null;
  retryAfterSeconds: number | null;
  limit: number | null;
  hitCount: number | null;
  remaining: number | null;
}

export interface RateLimitErrorPayload {
  error: string;
  code: string;
  retryAfterSeconds: number;
}

export interface PublicWidgetRateLimitContext {
  ipHash: string;
  widgetIpHash: string;
  widgetSessionHash: string | null;
}

const PUBLIC_WIDGET_RATE_LIMITS: Record<
  PublicWidgetRateLimitEndpoint,
  (context: PublicWidgetRateLimitContext) => RateLimitRule[]
> = {
  chat: (context) => [
    {
      endpoint: "public_widget_chat",
      scopeKind: "ip_global",
      scopeKey: context.ipHash,
      windowSeconds: 10 * 60,
      limit: 120,
      code: "RATE_LIMITED_CHAT",
      message:
        "Too many chat messages are being sent right now. Please wait a moment and try again.",
    },
    {
      endpoint: "public_widget_chat",
      scopeKind: "widget_ip",
      scopeKey: context.widgetIpHash,
      windowSeconds: 60,
      limit: 30,
      code: "RATE_LIMITED_CHAT",
      message:
        "This chat is receiving messages too quickly right now. Please wait a moment and try again.",
    },
    ...(context.widgetSessionHash
      ? [
          {
            endpoint: "public_widget_chat",
            scopeKind: "widget_session",
            scopeKey: context.widgetSessionHash,
            windowSeconds: 60,
            limit: 12,
            code: "RATE_LIMITED_CHAT",
            message:
              "This chat is receiving messages too quickly right now. Please wait a moment and try again.",
          } satisfies RateLimitRule,
        ]
      : []),
  ],
  events: (context) => [
    {
      endpoint: "public_widget_events",
      scopeKind: "widget_ip",
      scopeKey: context.widgetIpHash,
      windowSeconds: 60,
      limit: 120,
      code: "RATE_LIMITED_EVENTS",
      message:
        "Too many widget activity events are being sent right now. Please try again later.",
    },
    ...(context.widgetSessionHash
      ? [
          {
            endpoint: "public_widget_events",
            scopeKind: "widget_session",
            scopeKey: context.widgetSessionHash,
            windowSeconds: 60,
            limit: 60,
            code: "RATE_LIMITED_EVENTS",
            message:
              "Too many widget activity events are being sent right now. Please try again later.",
          } satisfies RateLimitRule,
        ]
      : []),
  ],
  complete: (context) => [
    {
      endpoint: "public_widget_complete",
      scopeKind: "widget_ip",
      scopeKey: context.widgetIpHash,
      windowSeconds: 60,
      limit: 20,
      code: "RATE_LIMITED_COMPLETE",
      message:
        "Too many session completion requests are being sent right now. Please try again later.",
    },
    ...(context.widgetSessionHash
      ? [
          {
            endpoint: "public_widget_complete",
            scopeKind: "widget_session",
            scopeKey: context.widgetSessionHash,
            windowSeconds: 60,
            limit: 6,
            code: "RATE_LIMITED_COMPLETE",
            message:
              "Too many session completion requests are being sent right now. Please try again later.",
          } satisfies RateLimitRule,
        ]
      : []),
  ],
  leads: (context) => [
    {
      endpoint: "public_widget_leads",
      scopeKind: "widget_ip",
      scopeKey: context.widgetIpHash,
      windowSeconds: 10 * 60,
      limit: 5,
      code: "RATE_LIMITED_LEADS",
      message:
        "Too many lead submissions are being sent right now. Please wait a few minutes and try again.",
    },
    ...(context.widgetSessionHash
      ? [
          {
            endpoint: "public_widget_leads",
            scopeKind: "widget_session",
            scopeKey: context.widgetSessionHash,
            windowSeconds: 10 * 60,
            limit: 3,
            code: "RATE_LIMITED_LEADS",
            message:
              "Too many lead submissions are being sent right now. Please wait a few minutes and try again.",
          } satisfies RateLimitRule,
        ]
      : []),
  ],
};

export function resolveClientIp(request: NextRequest) {
  return resolveTrustedClientIp(request.headers);
}

function hashRateLimitValue(value: string) {
  return createHmac("sha256", getRateLimitSecret()).update(value).digest("hex");
}

export function buildPublicWidgetRateLimitContext(args: {
  request: NextRequest;
  widgetId: string;
  sessionId?: string | null;
}) {
  const clientIp = resolveClientIp(args.request) ?? "unknown";
  const widgetSession =
    typeof args.sessionId === "string" && args.sessionId.trim()
      ? args.sessionId.trim()
      : null;

  return {
    ipHash: hashRateLimitValue(`ip:${clientIp}`),
    widgetIpHash: hashRateLimitValue(`widget_ip:${args.widgetId}:${clientIp}`),
    widgetSessionHash: widgetSession
      ? hashRateLimitValue(`widget_session:${args.widgetId}:${widgetSession}`)
      : null,
  } satisfies PublicWidgetRateLimitContext;
}

export function getPublicWidgetRateLimitRules(
  endpoint: PublicWidgetRateLimitEndpoint,
  context: PublicWidgetRateLimitContext,
) {
  return PUBLIC_WIDGET_RATE_LIMITS[endpoint](context);
}

export async function enforceRateLimits(
  supabase: RateLimitRpcClient,
  rules: RateLimitRule[],
): Promise<RateLimitDecision> {
  for (const rule of rules) {
    const { data, error } = await supabase.rpc<RateLimitRpcResult[]>(
      "consume_rate_limit_window",
      {
        p_scope_kind: rule.scopeKind,
        p_scope_key: rule.scopeKey,
        p_endpoint: rule.endpoint,
        p_window_seconds: rule.windowSeconds,
        p_limit: rule.limit,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const row = Array.isArray(data) ? data[0] ?? null : data ?? null;

    if (!row?.allowed) {
      return {
        allowed: false,
        endpoint: rule.endpoint,
        scopeKind: rule.scopeKind,
        code: rule.code,
        message: rule.message,
        retryAfterSeconds:
          typeof row?.retry_after_seconds === "number" &&
          row.retry_after_seconds > 0
            ? row.retry_after_seconds
            : rule.windowSeconds,
        limit:
          typeof row?.limit_value === "number" ? row.limit_value : rule.limit,
        hitCount:
          typeof row?.hit_count === "number" ? row.hit_count : null,
        remaining:
          typeof row?.remaining === "number" ? row.remaining : 0,
      };
    }
  }

  return {
    allowed: true,
    endpoint: null,
    scopeKind: null,
    code: null,
    message: null,
    retryAfterSeconds: null,
    limit: null,
    hitCount: null,
    remaining: null,
  };
}

export function buildRateLimitErrorPayload(
  decision: RateLimitDecision,
): RateLimitErrorPayload {
  return {
    error: decision.message ?? "Too many requests. Please try again later.",
    code: decision.code ?? "RATE_LIMITED",
    retryAfterSeconds: decision.retryAfterSeconds ?? 1,
  };
}
