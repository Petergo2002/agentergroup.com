"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// React 19 flags inline scripts inside components during client rendering.
// next-themes uses an inline script to prevent theme flashing on load.
// We safely suppress this specific benign warning in development.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) {
      return;
    }
    origConsoleError.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
