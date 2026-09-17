function resolveOrigin(value: string | undefined, fallback = "") {
  const originValue = value ?? fallback;
  if (!originValue) return "";

  try {
    return new URL(originValue).origin;
  } catch {
    return fallback;
  }
}

type AppContentSecurityPolicyOptions = {
  nonce?: string;
};

type AppSecurityHeadersOptions = {
  contentSecurityPolicy?: string | false;
};

export function buildAppContentSecurityPolicy({
  nonce,
}: AppContentSecurityPolicyOptions = {}) {
  const widgetAppOrigin = resolveOrigin(
    process.env.NEXT_PUBLIC_WIDGET_APP_URL ?? process.env.WIDGET_APP_URL,
    "http://localhost:5173",
  );
  const supabaseOrigin = resolveOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseConnectTokens = supabaseOrigin
    ? [supabaseOrigin, `wss://${new URL(supabaseOrigin).host}`]
    : [];
  const supabaseFrameTokens = supabaseOrigin ? [supabaseOrigin] : [];
  // Without this the browser SDK is silently dead: every event to Sentry's
  // ingest host is blocked by connect-src and nothing surfaces in the console
  // of the person who configured it. Derived from the DSN so the allowance
  // only exists when Sentry is actually configured, and only for that project's
  // own ingest host.
  const sentryIngestOrigin = resolveOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const sentryIngestTokens = sentryIngestOrigin ? [sentryIngestOrigin] : [];
  const scriptSrcTokens = ["'self'"];

  if (process.env.NODE_ENV === "development") {
    scriptSrcTokens.push("'unsafe-inline'", "'unsafe-eval'");
  } else if (nonce) {
    scriptSrcTokens.push(`'nonce-${nonce}'`);
  }

  scriptSrcTokens.push(widgetAppOrigin);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src ${scriptSrcTokens.join(" ")}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    "img-src 'self' data: blob: https:",
    `connect-src ${[
      "'self'",
      widgetAppOrigin,
      ...supabaseConnectTokens,
      ...sentryIngestTokens,
    ].join(" ")}`,
    `frame-src ${[
      "'self'",
      widgetAppOrigin,
      ...supabaseFrameTokens,
      "https://docs.google.com",
    ].join(" ")}`,
  ].join("; ");
}

export function getAppSecurityHeaders({
  contentSecurityPolicy,
}: AppSecurityHeadersOptions = {}) {
  const headers = [
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    },
  ];

  if (contentSecurityPolicy !== false) {
    headers.push({
      key: "Content-Security-Policy",
      value: contentSecurityPolicy ?? buildAppContentSecurityPolicy(),
    });
  }

  return headers;
}
