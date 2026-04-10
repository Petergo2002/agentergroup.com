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
  DEFAULT_PLATFORM_LANGUAGE,
  getMessages,
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
  initialMessages,
}: {
  children: React.ReactNode;
  initialLanguage: PlatformLanguage;
  initialMessages: Messages;
}) {
  const [language, setLanguageState] = useState<PlatformLanguage>(() => {
    if (typeof window === "undefined") {
      return initialLanguage;
    }

    return (
      resolvePlatformLanguage(window.localStorage.getItem(PLATFORM_LANGUAGE_STORAGE_KEY)) ||
      initialLanguage
    );
  });
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const languageRequestRef = useRef(0);
  const didResolveInitialMessagesRef = useRef(false);

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
    persistLanguage(language);
  }, [language]);

  useEffect(() => {
    if (didResolveInitialMessagesRef.current) {
      return;
    }

    didResolveInitialMessagesRef.current = true;

    if (language === initialLanguage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadLanguageMessages(language);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialLanguage, language, loadLanguageMessages]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PLATFORM_LANGUAGE_STORAGE_KEY) {
        return;
      }

      const next = resolvePlatformLanguage(event.newValue) || DEFAULT_PLATFORM_LANGUAGE;
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
