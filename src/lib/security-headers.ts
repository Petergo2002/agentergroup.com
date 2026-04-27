function resolveOrigin(value: string | undefined, fallback: string) {
  try {
    return new URL(value ?? fallback).origin;
  } catch {
    return fallback;
  }
}

export function buildAppContentSecurityPolicy() {
  const widgetAppOrigin = resolveOrigin(
    process.env.NEXT_PUBLIC_WIDGET_APP_URL ?? process.env.WIDGET_APP_URL,
    "http://localhost:5173",
  );
  const supabaseOrigin = resolveOrigin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "https://rklntfzmqayziqesjoih.supabase.co",
  );
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${widgetAppOrigin}`
      : `script-src 'self' ${widgetAppOrigin}`;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${widgetAppOrigin} ${supabaseOrigin} wss://${new URL(
      supabaseOrigin,
    ).host}`,
    `frame-src 'self' ${widgetAppOrigin} ${supabaseOrigin} https://docs.google.com`,
  ].join("; ");
}

export function getAppSecurityHeaders() {
  return [
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
      key: "Content-Security-Policy",
      value: buildAppContentSecurityPolicy(),
    },
  ];
}
