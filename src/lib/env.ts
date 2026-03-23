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

export function getSupabaseEnv() {
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

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseServiceRoleKey() {
  return requireEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
}

export function hasSupabaseServiceRoleEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
}

export function hasOpenRouterEnv() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export interface OpenRouterProviderPreferences {
  data_collection: "allow" | "deny";
  zdr?: boolean;
}

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

export function hasComposioEnv() {
  return Boolean(process.env.COMPOSIO_API_KEY);
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getWidgetAppUrl() {
  return (
    process.env.NEXT_PUBLIC_WIDGET_APP_URL ??
    process.env.WIDGET_APP_URL ??
    "http://localhost:5173"
  );
}

export function getGdprRetentionCronSecret() {
  return requireEnv(
    process.env.GDPR_RETENTION_CRON_SECRET,
    "GDPR_RETENTION_CRON_SECRET",
  );
}

export function hasGdprRetentionCronSecret() {
  return Boolean(process.env.GDPR_RETENTION_CRON_SECRET);
}
