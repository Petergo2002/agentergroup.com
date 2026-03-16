function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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
