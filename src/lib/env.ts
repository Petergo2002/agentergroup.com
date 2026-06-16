import { OPENROUTER_DEFAULT_AGENT_MODEL } from "./openrouter-models";

/** Shared environment helpers for the dashboard app and widget runtime. */

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

/**
 * Returns the required public Supabase environment variables.
 *
 * @returns The public Supabase URL and publishable key.
 */
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  return {
    url: requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    publishableKey: requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  };
}

/**
 * Checks whether the public Supabase environment is configured.
 *
 * @returns `true` when both public Supabase values are present.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Returns the required privileged Supabase API key for server operations.
 *
 * Prefer the current `sb_secret_...` key model, but keep the legacy
 * service-role key as a rollout fallback while older Supabase surfaces are
 * still being migrated.
 *
 * @returns The configured privileged Supabase key.
 */
export function getSupabaseAdminKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    requireEnv(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    )
  );
}

/**
 * Returns the legacy service-role key.
 *
 * @returns The configured legacy Supabase service-role key.
 */
export function getSupabaseServiceRoleKey(): string {
  return requireEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
}

/**
 * Checks whether a privileged Supabase server key is configured.
 *
 * @returns `true` when a current secret key or legacy service-role key exists.
 */
export function hasSupabaseAdminEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/**
 * Checks whether the legacy service-role key is configured.
 *
 * @returns `true` when the legacy service-role key exists.
 */
export function hasSupabaseServiceRoleEnv(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Returns the default OpenRouter model for agent turns.
 *
 * @returns The configured model id, or the repo default.
 */
export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_AGENT_MODEL;
}

/**
 * Checks whether OpenRouter can be used.
 *
 * @returns `true` when the OpenRouter API key exists.
 */
export function hasOpenRouterEnv(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export interface OpenRouterProviderPreferences {
  data_collection: "allow" | "deny";
  zdr?: boolean;
}

/**
 * Builds provider privacy preferences for OpenRouter requests.
 *
 * @returns The provider preference payload sent to OpenRouter.
 */
export function getOpenRouterProviderPreferences(): OpenRouterProviderPreferences {
  const dataCollection =
    process.env.OPENROUTER_DATA_COLLECTION?.trim().toLowerCase() === "allow"
      ? "allow"
      : "deny";
  const requireZdr = parseBooleanEnv(process.env.OPENROUTER_REQUIRE_ZDR, true);

  return {
    data_collection: dataCollection,
    ...(requireZdr ? { zdr: true } : {}),
  };
}

/**
 * Checks whether Composio-backed integrations are enabled.
 *
 * @returns `true` when the Composio API key exists.
 */
export function hasComposioEnv(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

/**
 * Checks whether Composio trigger webhooks can be verified.
 *
 * @returns `true` when the Composio webhook signing secret exists.
 */
export function hasComposioWebhookSecret(): boolean {
  return Boolean(process.env.COMPOSIO_WEBHOOK_SECRET);
}

/**
 * Returns the Composio webhook signing secret.
 *
 * @returns The configured webhook secret.
 */
export function getComposioWebhookSecret(): string {
  return requireEnv(
    process.env.COMPOSIO_WEBHOOK_SECRET,
    "COMPOSIO_WEBHOOK_SECRET",
  );
}

/**
 * Returns the public dashboard base URL.
 *
 * @returns The configured dashboard origin.
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Returns the hosted widget runtime base URL.
 *
 * @returns The configured widget origin, with support for the legacy alias.
 */
export function getWidgetAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WIDGET_APP_URL ??
    process.env.WIDGET_APP_URL ??
    "http://localhost:5173"
  );
}

/**
 * Returns the secret used by the GDPR retention cron route.
 *
 * @returns The configured retention secret.
 */
export function getGdprRetentionCronSecret(): string {
  return requireEnv(
    process.env.GDPR_RETENTION_CRON_SECRET,
    "GDPR_RETENTION_CRON_SECRET",
  );
}

/**
 * Checks whether the GDPR retention cron secret is configured.
 *
 * @returns `true` when the retention secret exists.
 */
export function hasGdprRetentionCronSecret(): boolean {
  return Boolean(process.env.GDPR_RETENTION_CRON_SECRET);
}

/**
 * Returns the secret used to hash public rate-limit identities.
 *
 * Prefers a dedicated rate-limit secret, but falls back to existing server-side
 * secrets so production does not require an extra setup step.
 *
 * @returns The configured rate-limit secret.
 */
export function getRateLimitSecret(): string {
  const explicitSecret = process.env.RATE_LIMIT_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const widgetSecret = process.env.WIDGET_ACCESS_SECRET?.trim();
  if (widgetSecret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "RATE_LIMIT_SECRET is not set. Falling back to WIDGET_ACCESS_SECRET. Set a dedicated RATE_LIMIT_SECRET for production.",
      );
    }
    return widgetSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "local-rate-limit-secret";
  }

  throw new Error(
    "RATE_LIMIT_SECRET is missing. Set RATE_LIMIT_SECRET or WIDGET_ACCESS_SECRET in production.",
  );
}
