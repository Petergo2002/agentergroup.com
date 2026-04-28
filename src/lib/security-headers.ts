function resolveOrigin(value: string | undefined, fallback: string) {
  try {
    return new URL(value ?? fallback).origin;
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
  const supabaseOrigin = resolveOrigin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "https://rklntfzmqayziqesjoih.supabase.co",
  );
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
    `connect-src 'self' ${widgetAppOrigin} ${supabaseOrigin} wss://${new URL(
      supabaseOrigin,
    ).host}`,
    `frame-src 'self' ${widgetAppOrigin} ${supabaseOrigin} https://docs.google.com`,
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
  ];

  if (contentSecurityPolicy !== false) {
    headers.push({
      key: "Content-Security-Policy",
      value: contentSecurityPolicy ?? buildAppContentSecurityPolicy(),
    });
  }

  return headers;
}
