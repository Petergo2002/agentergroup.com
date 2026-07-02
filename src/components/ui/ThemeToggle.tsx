"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="depth-card h-9 w-9 rounded-xl border border-outline-variant/10 bg-surface-container animate-pulse" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="depth-button relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container text-on-surface-variant transition-all hover:border-primary/20 hover:bg-surface-container-high hover:text-on-surface active:scale-90 group"
      aria-label="Toggle theme"
    >
      <div className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-[15deg]">
        <Sun 
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
            isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
          }`} 
        />
        <Moon 
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
            isDark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`} 
        />
      </div>
      
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:via-white/5" />
    </button>
  );
}
