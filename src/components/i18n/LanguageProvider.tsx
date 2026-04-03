"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createTranslator,
  DEFAULT_PLATFORM_LANGUAGE,
  PLATFORM_LANGUAGE_COOKIE,
  PLATFORM_LANGUAGE_COOKIE_MAX_AGE,
  PLATFORM_LANGUAGE_STORAGE_KEY,
  resolvePlatformLanguage,
  type PlatformLanguage,
} from "@/lib/i18n";
import type { Messages } from "@/locales/en";

interface LanguageContextValue {
  language: PlatformLanguage;
  messages: Messages;
  setLanguage: (language: PlatformLanguage) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function persistLanguage(language: PlatformLanguage) {
  window.localStorage.setItem(PLATFORM_LANGUAGE_STORAGE_KEY, language);
  document.cookie = `${PLATFORM_LANGUAGE_COOKIE}=${language}; path=/; max-age=${PLATFORM_LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
  document.documentElement.lang = language;
}

export function LanguageProvider({
  children,
  initialLanguage,
  messages,
}: {
  children: React.ReactNode;
  initialLanguage: PlatformLanguage;
  messages: Record<PlatformLanguage, Messages>;
}) {
  const [language, setLanguageState] = useState<PlatformLanguage>(initialLanguage);

  useEffect(() => {
    const stored = resolvePlatformLanguage(
      window.localStorage.getItem(PLATFORM_LANGUAGE_STORAGE_KEY),
    );
    const next = stored || DEFAULT_PLATFORM_LANGUAGE;

    if (next !== language) {
      setLanguageState(next);
    }

    persistLanguage(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PLATFORM_LANGUAGE_STORAGE_KEY) {
        return;
      }

      const next = resolvePlatformLanguage(event.newValue);
      setLanguageState(next);
      document.documentElement.lang = next;
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      messages: messages[language],
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage);
        persistLanguage(nextLanguage);
      },
      t: createTranslator(language),
    };
  }, [language, messages]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
