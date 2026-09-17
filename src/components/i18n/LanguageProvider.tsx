"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createTranslator,
  getMessages,
  LEGACY_PLATFORM_LANGUAGE_COOKIE,
  LEGACY_PLATFORM_LANGUAGE_STORAGE_KEY,
  PLATFORM_LANGUAGE_COOKIE,
  PLATFORM_LANGUAGE_COOKIE_MAX_AGE,
  PLATFORM_LANGUAGE_STORAGE_KEY,
  type PlatformLanguage,
} from "@/lib/i18n";
import type { Messages } from "@/locales/en";
import { resolveStoredLanguage, validLanguage } from "@/lib/language-preference";

interface LanguageContextValue {
  language: PlatformLanguage;
  messages: Messages;
  setLanguage: (language: PlatformLanguage) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function persistLanguage(language: PlatformLanguage) {
  try { window.localStorage.setItem(PLATFORM_LANGUAGE_STORAGE_KEY, language); } catch { /* Storage may be unavailable. */ }
  document.cookie = `${PLATFORM_LANGUAGE_COOKIE}=${language}; path=/; max-age=${PLATFORM_LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
  document.documentElement.lang = language;
}

export function LanguageProvider({
  children,
  initialLanguage,
  initialMessages,
}: {
  children: React.ReactNode;
  initialLanguage: PlatformLanguage;
  initialMessages: Messages;
}) {
  const [language, setLanguageState] = useState<PlatformLanguage>(initialLanguage);
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const languageRequestRef = useRef(0);

  const loadLanguageMessages = useCallback(
    async (nextLanguage: PlatformLanguage) => {
      const requestId = ++languageRequestRef.current;
      const nextMessages =
        nextLanguage === initialLanguage
          ? initialMessages
          : await getMessages(nextLanguage);

      if (languageRequestRef.current !== requestId) {
        return;
      }

      setMessages(nextMessages);
    },
    [initialLanguage, initialMessages],
  );

  const applyLanguage = useCallback(
    (nextLanguage: PlatformLanguage) => {
      if (nextLanguage === language) {
        persistLanguage(nextLanguage);
        return;
      }

      setLanguageState(nextLanguage);
      persistLanguage(nextLanguage);
      void loadLanguageMessages(nextLanguage);
    },
    [language, loadLanguageMessages],
  );

  useEffect(() => {
    // Start with the server render, then recover browser-only preferences.
    const hasCookie = document.cookie.split(";").some((part) => {
      const [key, value] = part.trim().split("=");
      return (key === PLATFORM_LANGUAGE_COOKIE || key === LEGACY_PLATFORM_LANGUAGE_COOKIE) && validLanguage(value);
    });
    if (!hasCookie) {
      try {
        const stored = resolveStoredLanguage(window.localStorage.getItem(PLATFORM_LANGUAGE_STORAGE_KEY), window.localStorage.getItem(LEGACY_PLATFORM_LANGUAGE_STORAGE_KEY), initialLanguage);
        if (stored !== initialLanguage) {
          const timer = window.setTimeout(() => { void applyLanguage(stored); }, 0);
          return () => window.clearTimeout(timer);
        }
      } catch { /* Keep the server language when browser storage is disabled. */ }
    }
    persistLanguage(language);
  }, [applyLanguage, initialLanguage, language]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== PLATFORM_LANGUAGE_STORAGE_KEY &&
        event.key !== LEGACY_PLATFORM_LANGUAGE_STORAGE_KEY
      ) {
        return;
      }

      if (!validLanguage(event.newValue)) return;
      const next = event.newValue;
      if (next === language) {
        persistLanguage(next);
        return;
      }

      void applyLanguage(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyLanguage, language]);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      messages,
      setLanguage: (nextLanguage) => {
        if (nextLanguage === language) {
          persistLanguage(nextLanguage);
          return;
        }

        void applyLanguage(nextLanguage);
      },
      t: createTranslator(messages),
    };
  }, [applyLanguage, language, messages]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
