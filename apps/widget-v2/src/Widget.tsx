import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Home,
  Loader2,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HomeTab } from "./components/HomeTab";
import { MessagesTab } from "./components/MessagesTab";
import { WidgetMark } from "./components/WidgetMark";
import { useSession } from "./hooks/useSession";
import {
  completeWidgetSession as requestWidgetSessionCompletion,
  getWidgetBootstrap,
  sendWidgetEvent,
  sendWidgetMessage,
  type WidgetRequestContext,
} from "./lib/api";
import {
  applyStreamFailureToMessages,
  resolveStreamedAgentContent,
  shouldRevealInterimStreamContent,
} from "./lib/streaming";
import { deriveWidgetPalette, hexToRgb } from "./theme";
import type {
  Message,
  WidgetAgentConfig,
  WidgetBootstrapResponse,
  WidgetConfig,
  WidgetEndChatReason,
  WidgetPreviewOverride,
} from "./types";

interface WidgetProps {
  widgetPublicKey: string;
  previewMode?: boolean;
  previewSource?: string;
  parentOrigin?: string;
  previewToken?: string;
  previewRevision?: string;
}

const PREVIEW_MESSAGE_TYPE = "ag:widget-preview:update-config";
const PREVIEW_RESET_MESSAGE_TYPE = "ag:widget-preview:reset-chat";
const PREVIEW_REQUEST_MESSAGE_TYPE = "ag:widget-preview:request-config";
const BOOTSTRAP_MESSAGE_TYPE = "ag:widget-bootstrap";
const BOOTSTRAP_REQUEST_MESSAGE_TYPE = "ag:widget-bootstrap:request";
const WIDGET_CLOSE_REQUEST_MESSAGE_TYPE = "ag:widget:close-request";
const WIDGET_STATE_MESSAGE_TYPE = "ag:widget:state";
const MIN_INTERIM_STREAM_RENDER_DELAY_MS = 250;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PRESENCE_DEDUPE_MS = 1_500;
type SessionPresenceEvent =
  | "widget_open"
  | "widget_close"
  | "page_hidden"
  | "page_visible"
  | "page_unload"
  | "heartbeat";

interface WidgetStateMessagePayload {
  type: typeof WIDGET_STATE_MESSAGE_TYPE;
  isOpen: boolean;
  at?: number;
}

interface WidgetBootstrapMessagePayload {
  type: typeof BOOTSTRAP_MESSAGE_TYPE;
  payload: WidgetBootstrapResponse;
}

interface WidgetPreviewResetPayload {
  type: typeof PREVIEW_RESET_MESSAGE_TYPE;
  payload?: {
    previewRevision?: string | number;
    reason?: string;
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function detectBrowserLanguage(): "sv" | "en" {
  if (typeof navigator !== "undefined") {
    const browserLanguage = navigator.language?.toLowerCase() || "";
    if (browserLanguage.startsWith("sv")) return "sv";
  }

  return "en";
}

function normalizeOriginValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveEmbeddedParentOrigin(parentOrigin?: string): string | null {
  const normalizedFromProp = normalizeOriginValue(parentOrigin);
  if (normalizedFromProp) return normalizedFromProp;
  if (typeof document === "undefined") return null;
  return normalizeOriginValue(document.referrer);
}

function buildLocalizedPrivacyPolicyUrl(
  value: string | null | undefined,
  language: "sv" | "en",
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const base =
      typeof window !== "undefined" ? window.location.href : "https://agentergroup.com";
    const parsed = new URL(trimmed, base);

    if (parsed.pathname === "/privacy-policy") {
      parsed.searchParams.set("lang", language);
    }

    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function parsePreviewOverrideMessage(
  data: unknown,
): WidgetPreviewOverride | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== PREVIEW_MESSAGE_TYPE) return null;
  const payload = data.payload;
  if (!isObjectRecord(payload)) return null;

  const next: WidgetPreviewOverride = {};

  if (isObjectRecord(payload.brand)) {
    next.brand = payload.brand as Partial<WidgetConfig["brand"]>;
  }

  if (isObjectRecord(payload.widget)) {
    next.widget = payload.widget as Partial<WidgetConfig["widget"]>;
  }

  if (isObjectRecord(payload.home)) {
    next.home = payload.home as Partial<WidgetConfig["home"]>;
  }

  if (isObjectRecord(payload.agent)) {
    next.agent = payload.agent as WidgetPreviewOverride["agent"];
  }

  if (typeof payload.orgName === "string") {
    next.brand = {
      ...(next.brand ?? {}),
      name: payload.orgName,
    };
  }

  if (isObjectRecord(payload.agentSettings)) {
    next.agent = {
      ...(next.agent ?? {}),
      ...(payload.agentSettings as WidgetPreviewOverride["agent"]),
    };
  }

  if (isObjectRecord(payload.widgetSettings)) {
    next.widget = {
      ...(next.widget ?? {}),
      ...(payload.widgetSettings as Partial<WidgetConfig["widget"]>),
    };
  }

  return next;
}

function parseWidgetStateMessage(
  data: unknown,
): WidgetStateMessagePayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== WIDGET_STATE_MESSAGE_TYPE) return null;
  if (typeof data.isOpen !== "boolean") return null;

  return {
    type: WIDGET_STATE_MESSAGE_TYPE,
    isOpen: data.isOpen,
    at: typeof data.at === "number" ? data.at : undefined,
  };
}

function parsePreviewResetMessage(
  data: unknown,
): WidgetPreviewResetPayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== PREVIEW_RESET_MESSAGE_TYPE) return null;
  const payload = isObjectRecord(data.payload) ? data.payload : undefined;

  return {
    type: PREVIEW_RESET_MESSAGE_TYPE,
    payload: payload
      ? {
          previewRevision:
            typeof payload.previewRevision === "string" ||
            typeof payload.previewRevision === "number"
              ? payload.previewRevision
              : undefined,
          reason:
            typeof payload.reason === "string" ? payload.reason : undefined,
        }
      : undefined,
  };
}

function parseWidgetBootstrapMessage(
  data: unknown,
): WidgetBootstrapMessagePayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== BOOTSTRAP_MESSAGE_TYPE) return null;
  if (!isObjectRecord(data.payload)) return null;
  if (!isObjectRecord(data.payload.config)) return null;

  return {
    type: BOOTSTRAP_MESSAGE_TYPE,
    payload: data.payload as WidgetBootstrapResponse,
  };
}



const WIDGET_DEFAULTS: Record<"sv" | "en", {
  agentLabel: string;
  greeting: string;
  placeholder: string;
  homeTitle: string;
  greetingFallback: string;
  placeholderFallback: string;
}> = {
  sv: {
    agentLabel: "AI-Agent",
    greeting: "Hej! Hur kan jag hjälpa dig idag?",
    greetingFallback: "Hi! How can I help you today?",
    placeholder: "Skriv ett meddelande...",
    placeholderFallback: "Write a message...",
    homeTitle: "Hur kan vi hjälpa till?",
  },
  en: {
    agentLabel: "AI Agent",
    greeting: "Hi! How can I help you today?",
    greetingFallback: "Hej! Hur kan jag hjälpa dig idag?",
    placeholder: "Write a message...",
    placeholderFallback: "Skriv ett meddelande...",
    homeTitle: "How can we help?",
  },
};

function getLocalizedDefault(
  value: string | null | undefined,
  key: keyof typeof WIDGET_DEFAULTS["en"],
  language: "sv" | "en",
): string {
  const trimmed = value?.trim() ?? "";
  const defaults = WIDGET_DEFAULTS[language];
  const opposite = WIDGET_DEFAULTS[language === "sv" ? "en" : "sv"];
  // If empty or still holds the opposite language default, return localized default
  if (!trimmed || trimmed === opposite[key]) return defaults[key];
  return trimmed;
}

function normalizeWidgetConfig(config: WidgetConfig): WidgetConfig {
  const language = resolveWidgetLanguage(config);
  const d = WIDGET_DEFAULTS[language];

  const normalizedAgents = Array.isArray(config.agents)
    ? config.agents
        .map((agent) => {
          if (!agent || typeof agent !== "object") {
            return null;
          }

          return {
            widgetAgentId: String(agent.widgetAgentId ?? "").trim(),
            agentId: String(agent.agentId ?? "").trim(),
            label: agent.label?.trim() || d.agentLabel,
            description: agent.description?.trim() || "",
            icon:
              typeof agent.icon === "string" && agent.icon.trim()
                ? agent.icon.trim()
                : null,
            interactionMode:
              agent.interactionMode === "contact_form"
                ? "contact_form"
                : "chat",
            greeting: getLocalizedDefault(agent.greeting, "greeting", language),
            placeholder: getLocalizedDefault(agent.placeholder, "placeholder", language),
            quickActions: Array.isArray(agent.quickActions)
              ? agent.quickActions
              : [],
            endChatPolicy: {
              enabled: Boolean(agent.endChatPolicy?.enabled),
              inactivityTimeoutSeconds:
                typeof agent.endChatPolicy?.inactivityTimeoutSeconds === "number" &&
                agent.endChatPolicy.inactivityTimeoutSeconds > 0
                  ? Math.round(agent.endChatPolicy.inactivityTimeoutSeconds)
                  : null,
              allowAssistantSuggestion:
                agent.endChatPolicy?.allowAssistantSuggestion !== false,
            },
          } satisfies WidgetAgentConfig;
        })
        .filter(Boolean) as WidgetAgentConfig[]
    : [];

  return {
    ...config,
    widgetId: config.widgetId || config.widgetPublicKey,
    brand: {
      name: config.brand?.name || "Agent",
      logoUrl: config.brand?.logoUrl ?? null,
      privacyPolicyUrl: config.brand?.privacyPolicyUrl ?? null,
    },
    widget: {
      language: config.widget?.language ?? detectBrowserLanguage(),
      theme: config.widget?.theme === "light" ? "light" : "dark",
      primaryColor: config.widget?.primaryColor || "#ff5c00",
      backgroundColor: config.widget?.backgroundColor || "#0a0a0a",
      textColor: config.widget?.textColor || "#f5f5f5",
      showBranding: config.widget?.showBranding ?? true,
    },
    home: {
      mode:
        config.home?.mode === "single_auto" && normalizedAgents.length === 1
          ? "single_auto"
          : "chooser",
      title: getLocalizedDefault(config.home?.title, "homeTitle", language),
      subtitle: config.home?.subtitle ?? null,
    },
    agents: normalizedAgents,
  };
}

function resolveWidgetLanguage(config: WidgetConfig | null): "sv" | "en" {
  return config?.widget.language ?? detectBrowserLanguage();
}

function resolveSelectedAgent(
  config: WidgetConfig | null,
  selectedWidgetAgentId: string | null,
) {
  if (!config) return null;

  if (selectedWidgetAgentId) {
    return (
      config.agents.find(
        (agent) => agent.widgetAgentId === selectedWidgetAgentId,
      ) ?? null
    );
  }

  if (config.home.mode === "single_auto") {
    return config.agents[0] ?? null;
  }

  return null;
}

async function readJsonError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  const error = new Error(
    typeof payload?.error === "string" ? payload.error : fallback,
  ) as Error & { code?: string };
  if (typeof payload?.code === "string") {
    error.code = payload.code;
  }
  throw error;
}

export default function Widget({
  widgetPublicKey,
  previewMode = false,
  previewSource,
  parentOrigin,
  previewToken,
  previewRevision,
}: WidgetProps) {
  const isEmbedded =
    typeof window !== "undefined" && window.parent !== window;
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [selectedWidgetAgentId, setSelectedWidgetAgentId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "messages">("home");
  const [hasUnread, setHasUnread] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [widgetContext, setWidgetContext] =
    useState<WidgetBootstrapResponse["source"]>(
      previewMode ? "preview" : "hosted",
    );
  const [isConversationCompleted, setIsConversationCompleted] = useState(false);
  const [conversationEndReason, setConversationEndReason] =
    useState<WidgetEndChatReason | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(() =>
    typeof window !== "undefined" ? window.parent === window : true,
  );
  const [previewRevisionKey, setPreviewRevisionKey] = useState(
    previewRevision || "0",
  );
  const embeddedParentOrigin = isEmbedded
    ? resolveEmbeddedParentOrigin(parentOrigin)
    : null;
  const { sessionId, reset: resetWidgetSession } = useSession(widgetPublicKey, {
    persist: !previewMode,
  });
  const sessionEventDedupRef = useRef<Record<string, number>>({});
  const previousWidgetOpenRef = useRef<boolean | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);

  const bootstrapContext = useMemo<WidgetRequestContext>(
    () => ({
      previewToken: previewMode ? previewToken : undefined,
      previewSource:
        previewMode ? previewSource || "widget_preview" : undefined,
      previewRevision: previewMode ? previewRevisionKey : undefined,
    }),
    [
      previewMode,
      previewRevisionKey,
      previewSource,
      previewToken,
    ],
  );
  const requestContext = useMemo<WidgetRequestContext>(
    () => ({
      ...bootstrapContext,
      accessToken,
    }),
    [accessToken, bootstrapContext],
  );

  const selectedAgent = useMemo(
    () => resolveSelectedAgent(config, selectedWidgetAgentId),
    [config, selectedWidgetAgentId],
  );

  const applyBootstrapPayload = useCallback((payload: WidgetBootstrapResponse) => {
    setConfig(normalizeWidgetConfig(payload.config));
    setAccessToken(payload.accessToken ?? null);
    setWidgetContext(payload.source);
    setError(null);
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const markConversationCompleted = useCallback(
    (reason: WidgetEndChatReason | null) => {
      clearInactivityTimer();
      setIsConversationCompleted(true);
      setConversationEndReason(reason);
    },
    [clearInactivityTimer],
  );

  const armInactivityTimer = useCallback(
    (timeoutSeconds: number | null | undefined) => {
      clearInactivityTimer();

      if (!timeoutSeconds || timeoutSeconds <= 0) {
        return;
      }

      inactivityTimerRef.current = window.setTimeout(() => {
        void requestWidgetSessionCompletion(
          widgetPublicKey,
          {
            sessionId,
            reason: "inactivity_timeout",
          },
          requestContext,
        )
          .then((payload) => {
            if (payload.sessionCompleted) {
              markConversationCompleted(
                payload.endReason === "inactivity_timeout"
                  ? "inactivity_timeout"
                  : payload.endReason === "assistant_suggestion"
                  ? "assistant_suggestion"
                  : null,
              );
            }
          })
          .catch((nextError) => {
            console.error("Failed to complete inactive chat:", nextError);
          });
      }, timeoutSeconds * 1000);
    },
    [
      clearInactivityTimer,
      markConversationCompleted,
      requestContext,
      sessionId,
      widgetPublicKey,
    ],
  );

  const resetConversation = useCallback(
    (nextPreviewRevision?: string | number) => {
      clearInactivityTimer();
      resetWidgetSession();
      setMessages([]);
      setHasStarted(false);
      setInput("");
      setIsLoading(false);
      setIsStreaming(false);
      setIsConversationCompleted(false);
      setConversationEndReason(null);
      setHasUnread(false);
      setActiveTab("home");
      setError(null);
      setAccessToken(null);
      setSelectedWidgetAgentId(
        config?.home.mode === "single_auto" ? config.agents[0]?.widgetAgentId ?? null : null,
      );

      if (!previewMode) return;
      const fallbackRevision = `${Date.now()}`;
      setPreviewRevisionKey(
        nextPreviewRevision !== undefined
          ? String(nextPreviewRevision)
          : fallbackRevision,
      );
    },
    [clearInactivityTimer, config, previewMode, resetWidgetSession],
  );

  useEffect(() => {
    if (!previewMode) return;
    if (previewRevision === undefined) return;
    setPreviewRevisionKey(String(previewRevision));
    resetConversation(previewRevision);
  }, [previewMode, previewRevision, resetConversation]);

  useEffect(() => {
    if (activeTab === "home" && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "agent" && !lastMessage.isStreaming) {
        setHasUnread(true);
      }
    } else if (activeTab === "messages") {
      setHasUnread(false);
    }
  }, [messages, activeTab]);

  const sendSessionEvent = useCallback(
    (
      event: SessionPresenceEvent,
      options?: {
        preferBeacon?: boolean;
        dedupeKey?: string;
        dedupeMs?: number;
      },
    ) => {
      if (!widgetPublicKey || !sessionId) return;
      if (!requestContext.accessToken && !requestContext.previewToken) return;

      const dedupeKey = options?.dedupeKey || event;
      const dedupeWindowMs = options?.dedupeMs ?? 0;
      if (dedupeWindowMs > 0) {
        const now = Date.now();
        const previous = sessionEventDedupRef.current[dedupeKey];
        if (typeof previous === "number" && now - previous < dedupeWindowMs) {
          return;
        }
        sessionEventDedupRef.current[dedupeKey] = now;
      }

      void sendWidgetEvent(
        widgetPublicKey,
        {
          sessionId,
          event,
          occurredAt: new Date().toISOString(),
          pageUrl:
            typeof window !== "undefined" ? window.location.href : undefined,
          referrer:
            typeof document !== "undefined" ? document.referrer : undefined,
          visibilityState:
            typeof document !== "undefined"
              ? document.visibilityState
              : undefined,
        },
        requestContext,
        { preferBeacon: options?.preferBeacon },
      );
    },
    [requestContext, sessionId, widgetPublicKey],
  );

  useEffect(() => {
    const updateVh = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(
        "--widget-vh",
        `${height * 0.01}px`,
      );
    };

    updateVh();
    window.addEventListener("resize", updateVh);
    window.visualViewport?.addEventListener("resize", updateVh);
    window.visualViewport?.addEventListener("scroll", updateVh);

    return () => {
      window.removeEventListener("resize", updateVh);
      window.visualViewport?.removeEventListener("resize", updateVh);
      window.visualViewport?.removeEventListener("scroll", updateVh);
    };
  }, []);

  useEffect(() => {
    if (!widgetPublicKey) {
      setError("Missing widget key.");
      return;
    }

    if (isEmbedded) {
      return;
    }

    let cancelled = false;

    async function fetchBootstrap() {
      try {
        const payload = await getWidgetBootstrap(widgetPublicKey, bootstrapContext);
        if (!cancelled) {
          applyBootstrapPayload(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          console.error("Failed to bootstrap widget:", nextError);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Could not load widget",
          );
        }
      }
    }

    void fetchBootstrap();

    return () => {
      cancelled = true;
    };
  }, [applyBootstrapPayload, bootstrapContext, isEmbedded, widgetPublicKey]);

  useEffect(() => {
    if (!widgetPublicKey || !isEmbedded) {
      return;
    }

    const handleBootstrapMessage = (event: MessageEvent) => {
      if (window.parent === window) return;
      if (event.source !== window.parent) return;
      if (!embeddedParentOrigin || event.origin !== embeddedParentOrigin) {
        return;
      }

      const bootstrap = parseWidgetBootstrapMessage(event.data);
      if (!bootstrap) return;
      applyBootstrapPayload(bootstrap.payload);
    };

    window.addEventListener("message", handleBootstrapMessage);

    if (window.parent !== window && embeddedParentOrigin) {
      window.parent.postMessage(
        { type: BOOTSTRAP_REQUEST_MESSAGE_TYPE },
        embeddedParentOrigin,
      );
    }

    return () => {
      window.removeEventListener("message", handleBootstrapMessage);
    };
  }, [
    applyBootstrapPayload,
    embeddedParentOrigin,
    isEmbedded,
    previewRevisionKey,
    widgetPublicKey,
  ]);

  useEffect(() => {
    if (!config) return;

    setSelectedWidgetAgentId((current) => {
      if (
        current &&
        config.agents.some((agent) => agent.widgetAgentId === current)
      ) {
        return current;
      }

      if (config.home.mode === "single_auto") {
        return config.agents[0]?.widgetAgentId ?? null;
      }

      return null;
    });
  }, [config]);

  useEffect(() => {
    const handleWidgetStateChange = (event: MessageEvent) => {
      if (window.parent === window) return;
      if (event.source !== window.parent) return;
      if (!embeddedParentOrigin || event.origin !== embeddedParentOrigin) {
        return;
      }

      const nextState = parseWidgetStateMessage(event.data);
      if (!nextState) return;
      setIsWidgetOpen(nextState.isOpen);
    };

    window.addEventListener("message", handleWidgetStateChange);
    return () => {
      window.removeEventListener("message", handleWidgetStateChange);
    };
  }, [embeddedParentOrigin]);

  useEffect(() => {
    const previousState = previousWidgetOpenRef.current;
    if (previousState === null) {
      previousWidgetOpenRef.current = isWidgetOpen;
      if (window.parent === window && isWidgetOpen) {
        sendSessionEvent("widget_open");
      }
      return;
    }

    if (previousState !== isWidgetOpen) {
      sendSessionEvent(isWidgetOpen ? "widget_open" : "widget_close");
      previousWidgetOpenRef.current = isWidgetOpen;
    }
  }, [isWidgetOpen, sendSessionEvent]);

  useEffect(() => {
    if (!isWidgetOpen) return;

    const heartbeatTimer = window.setInterval(() => {
      sendSessionEvent("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(heartbeatTimer);
    };
  }, [isWidgetOpen, sendSessionEvent]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendSessionEvent("page_hidden", {
          preferBeacon: true,
          dedupeKey: "exit-signal",
          dedupeMs: PRESENCE_DEDUPE_MS,
        });
        return;
      }

      sendSessionEvent("page_visible", {
        dedupeKey: "visible-signal",
        dedupeMs: PRESENCE_DEDUPE_MS,
      });
    };

    const handlePageHide = () => {
      sendSessionEvent("page_unload", {
        preferBeacon: true,
        dedupeKey: "exit-signal",
        dedupeMs: PRESENCE_DEDUPE_MS,
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [sendSessionEvent]);

  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, [clearInactivityTimer]);

  useEffect(() => {
    clearInactivityTimer();
  }, [clearInactivityTimer, selectedWidgetAgentId, sessionId]);

  useEffect(() => {
    if (isConversationCompleted) {
      clearInactivityTimer();
    }
  }, [clearInactivityTimer, isConversationCompleted]);

  useEffect(() => {
    if (!previewMode) return;

    const handlePreviewMessage = (event: MessageEvent) => {
      if (window.parent === window) return;
      if (event.source !== window.parent) return;
      if (!embeddedParentOrigin || event.origin !== embeddedParentOrigin) {
        return;
      }

      const resetSignal = parsePreviewResetMessage(event.data);
      if (resetSignal) {
        resetConversation(resetSignal.payload?.previewRevision);
        return;
      }

      const override = parsePreviewOverrideMessage(event.data);
      if (!override) return;

      setConfig((previous) => {
        if (!previous) return previous;

        return normalizeWidgetConfig({
          ...previous,
          brand: {
            ...previous.brand,
            ...(override.brand ?? {}),
          },
          widget: {
            ...previous.widget,
            ...(override.widget ?? {}),
          },
          home: {
            ...previous.home,
            ...(override.home ?? {}),
          },
          agents:
            override.agent && previous.agents.length === 1
              ? previous.agents.map((agent) => ({
                  ...agent,
                  ...override.agent,
                }))
              : previous.agents,
        });
      });
    };

    window.addEventListener("message", handlePreviewMessage);
    if (window.parent !== window && embeddedParentOrigin) {
      window.parent.postMessage(
        { type: PREVIEW_REQUEST_MESSAGE_TYPE },
        embeddedParentOrigin,
      );
    }

    return () => {
      window.removeEventListener("message", handlePreviewMessage);
    };
  }, [embeddedParentOrigin, previewMode, previewRevisionKey, resetConversation]);

  const handleClose = () => {
    if (window.parent === window || !embeddedParentOrigin) return;
    window.parent.postMessage(
      { type: WIDGET_CLOSE_REQUEST_MESSAGE_TYPE },
      embeddedParentOrigin,
    );
  };

  const sendMessage = async (text: string = input) => {
    const activeLanguage = resolveWidgetLanguage(config);
    const activeAgent = resolveSelectedAgent(config, selectedWidgetAgentId);
    const activeEndChatPolicy =
      activeAgent?.interactionMode === "chat"
        ? activeAgent.endChatPolicy
        : null;
    const trimmedMessage = text.trim();

    if (!trimmedMessage) {
      return;
    }

    if (
      isConversationCompleted ||
      isLoading ||
      isStreaming ||
      !widgetPublicKey ||
      !activeAgent
    ) {
      return;
    }

    clearInactivityTimer();
    if (!hasStarted) setHasStarted(true);
    setActiveTab("messages");

    const userMessage = trimmedMessage;
    setInput("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: userMessage },
    ]);
    setIsLoading(true);

    try {
      const response = await sendWidgetMessage(
        widgetPublicKey,
        {
          sessionId,
          message: userMessage,
          widgetAgentId: activeAgent.widgetAgentId,
          language: activeLanguage,
          pageUrl:
            typeof window !== "undefined" ? window.location.href : undefined,
          referrer:
            typeof document !== "undefined" ? document.referrer : undefined,
        },
        requestContext,
      );

      if (!response.ok) {
        await readJsonError(response, "Failed to get response.");
      }

      if (!response.body) {
        throw new Error("No response stream from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let sseBuffer = "";
      let latestRendered = "";
      let pendingRender: number | null = null;
      let streamDone = false;
      let streamError: Error | null = null;
      let streamCompleted = false;
      let streamEndReason: WidgetEndChatReason | null = null;
      const streamStartedAt = Date.now();
      let hasRevealedInterimContent = false;

      setMessages((previous) => [
        ...previous,
        { role: "agent", content: "", isStreaming: true },
      ]);
      setIsStreaming(true);

      const updateAssistantMessage = (content: string, streaming: boolean) => {
        setMessages((previous) => {
          if (previous.length === 0) return previous;
          const next = [...previous];
          const last = next[next.length - 1];
          if (!last || last.role !== "agent") return previous;
          next[next.length - 1] = {
            ...last,
            content: resolveStreamedAgentContent({
              previousContent: last.content || "",
              incomingContent: content,
              streaming,
            }),
            isStreaming: streaming,
          };
          return next;
        });
      };

      const flushRendered = (force = false) => {
        if (pendingRender !== null && force) {
          cancelAnimationFrame(pendingRender);
          pendingRender = null;
        }
        const shouldReveal = shouldRevealInterimStreamContent({
          nowMs: Date.now(),
          streamStartedAtMs: streamStartedAt,
          minDelayMs: MIN_INTERIM_STREAM_RENDER_DELAY_MS,
          streamDone,
          hasRevealedInterimContent,
        });
        if (!force && !shouldReveal) return;
        if (latestRendered === fullText) return;
        if (!hasRevealedInterimContent && fullText) {
          hasRevealedInterimContent = true;
        }
        latestRendered = fullText;
        updateAssistantMessage(fullText, true);
      };

      const scheduleRenderedFlush = () => {
        if (pendingRender !== null) return;
        pendingRender = requestAnimationFrame(() => {
          pendingRender = null;
          flushRendered();
        });
      };

      const processEventData = (data: string) => {
        if (data === "[DONE]") {
          streamDone = true;
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed?.error === "string") {
            streamError = new Error(parsed.error);
            streamDone = true;
            return;
          }
          if (parsed?.sessionCompleted === true) {
            streamCompleted = true;
            streamEndReason =
              parsed.endReason === "assistant_suggestion" ||
              parsed.endReason === "inactivity_timeout"
                ? parsed.endReason
                : null;
            markConversationCompleted(streamEndReason);
          }
          if (typeof parsed?.content === "string") {
            fullText = parsed.content;
            scheduleRenderedFlush();
          }
        } catch {
          // Ignore malformed stream payloads.
        }
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        let separatorIndex = sseBuffer.indexOf("\n\n");

        while (separatorIndex !== -1) {
          const eventBlock = sseBuffer.slice(0, separatorIndex);
          sseBuffer = sseBuffer.slice(separatorIndex + 2);

          for (const line of eventBlock.split("\n")) {
            if (line.startsWith("data: ")) {
              processEventData(line.slice(6).trim());
            }
          }

          if (streamError) {
            throw streamError;
          }
          if (streamDone) break;
          separatorIndex = sseBuffer.indexOf("\n\n");
        }
      }

      sseBuffer += decoder.decode(new Uint8Array(), { stream: false });
      if (sseBuffer.trim()) {
        for (const line of sseBuffer.split("\n")) {
          if (line.startsWith("data: ")) {
            processEventData(line.slice(6).trim());
          }
        }
      }

      if (streamError) {
        throw streamError;
      }

      flushRendered(true);
      updateAssistantMessage(
        fullText || "Sorry, something went wrong. Please try again.",
        false,
      );
      setIsStreaming(false);

      if (
        !streamCompleted &&
        activeEndChatPolicy?.enabled &&
        activeEndChatPolicy.inactivityTimeoutSeconds
      ) {
        armInactivityTimer(activeEndChatPolicy.inactivityTimeoutSeconds);
      } else if (streamCompleted) {
        setConversationEndReason(streamEndReason);
      }
    } catch (nextError) {
      console.error("Chat error:", nextError);
      const isSessionCompletedError =
        nextError instanceof Error &&
        "code" in nextError &&
        (nextError as Error & { code?: string }).code === "SESSION_COMPLETED";

      if (isSessionCompletedError) {
        markConversationCompleted(null);
        setIsStreaming(false);
      } else {
        setMessages((previous) =>
          applyStreamFailureToMessages(
            previous,
            nextError instanceof Error
              ? nextError.message
              : "Sorry, something went wrong. Please try again.",
          ),
        );
      }
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

  const widgetLanguage = config ? resolveWidgetLanguage(config) : "en";
  const isChooserMode =
    config?.home.mode === "chooser" && selectedAgent === null;
  const navLabelHome = widgetLanguage === "sv" ? "Hem" : "Home";
  const navLabelMessages = widgetLanguage === "sv" ? "Meddelanden" : "Messages";
  const newChatLabel = widgetLanguage === "sv" ? "Starta ny chatt" : "Start a new chat";



  useEffect(() => {
    if (config?.home.mode === "chooser" && !selectedAgent && activeTab === "messages") {
      setActiveTab("home");
    }
  }, [activeTab, config?.home.mode, selectedAgent]);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen bg-widget-bg text-widget-fg">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <Loader2 className="w-8 h-8 animate-spin text-widget-primary" />
        )}
      </div>
    );
  }

  const themeMode = config.widget.theme === "light" ? "light" : "dark";
  const palette = deriveWidgetPalette(config.widget.primaryColor, themeMode);
  const rgb = hexToRgb(palette.primary);
  const primaryRgb = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  const privacyPolicyUrl = buildLocalizedPrivacyPolicyUrl(
    config.brand.privacyPolicyUrl,
    widgetLanguage,
  );

  return (
    <div
      className={`relative h-screen w-full flex flex-col overflow-hidden selection:bg-widget-primary/30 ${
        themeMode === "dark" ? "dark bg-stitch-gradient" : "bg-widget-bg"
      }`}
      style={
        {
          "--widget-bg": palette.bg,
          "--widget-fg": palette.fg,
          "--widget-card": palette.card,
          "--widget-border": palette.border,
          "--widget-primary": palette.primary,
          "--widget-primary-rgb": primaryRgb,
          "--widget-primary-fg": palette.primaryFg,
          "--widget-muted": palette.muted,
          color: palette.fg,
          height: "calc(var(--widget-vh, 1vh) * 100)",
          minHeight: "100dvh",
        } as CSSProperties
      }
    >
      {themeMode === "dark" && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none bg-stitch-glow z-0"
        />
      )}

      <div
        className={`relative z-10 flex h-full flex-col ${
          widgetContext === "hosted" ? "w-full" : ""
        }`}
      >
        <header className="relative flex items-center justify-between px-6 pb-4 pt-12 shrink-0 md:px-10 lg:px-14">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {((activeTab === "messages" && selectedAgent) ||
                (activeTab === "home" && selectedAgent && config.home.mode === "chooser" && !hasStarted)) && (
                <motion.button
                  key="back-button"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => {
                    if (activeTab === "messages") {
                      setActiveTab("home");
                    } else {
                      setSelectedWidgetAgentId(null);
                    }
                  }}
                  className="mr-1 p-1 text-widget-muted hover:text-widget-fg transition-colors"
                  aria-label={navLabelHome}
                >
                  <ChevronLeft className="w-6 h-6" />
                </motion.button>
              )}
            </AnimatePresence>

            {config.brand.logoUrl ? (
              // The widget app is built with Vite, so `next/image` is not available here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.brand.logoUrl}
                alt={config.brand.name}
                className="w-8 h-8 rounded-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <WidgetMark className="w-8 h-8" />
            )}
          </div>

          <div
            className={`absolute inset-x-0 top-[3.75rem] flex justify-center pointer-events-none select-none z-0 ${
              activeTab === "messages" ? "px-28" : "px-20"
            }`}
          >
            <span
              className={`block max-w-full truncate text-center font-semibold uppercase text-widget-fg opacity-45 ${
                activeTab === "messages"
                  ? "text-[9px] tracking-[0.12em] sm:text-[10px] sm:tracking-[0.14em]"
                  : "text-[10px] tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]"
              }`}
              style={{
                textShadow:
                  themeMode === "dark"
                    ? "0px 1px 1px rgba(255,255,255,0.05), 0px -1px 1px rgba(0,0,0,0.4)"
                    : "0px 1px 1px rgba(255,255,255,0.8), 0px -1px 0.5px rgba(0,0,0,0.1)",
              }}
            >
              {config.brand.name || "AgenterGroup"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {hasStarted && (
              <button
                onClick={() => resetConversation()}
                className="text-widget-muted hover:text-widget-fg transition-colors p-2"
                aria-label={newChatLabel}
                title={newChatLabel}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            {isEmbedded ? (
              <button
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-widget-border bg-widget-card/90 text-widget-fg shadow-sm transition-colors hover:border-widget-primary/30 hover:text-widget-fg"
                aria-label={widgetLanguage === "sv" ? "Stäng" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === "home" || !selectedAgent ? (
              <HomeTab
                key="home"
                config={config}
                selectedAgent={selectedAgent}
                isChooserMode={isChooserMode}
                onSendMessage={sendMessage}
                onSelectAgent={(widgetAgentId) => {
                  setSelectedWidgetAgentId(widgetAgentId);
                  setActiveTab("home");
                }}
                onSwitchToMessages={() => setActiveTab("messages")}
              />
            ) : (
              <MessagesTab
                key="messages"
                config={config}
                privacyPolicyUrl={privacyPolicyUrl}
                selectedAgent={selectedAgent}
                messages={messages}
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                isStreaming={isStreaming}
                hasStarted={hasStarted}
                isConversationCompleted={isConversationCompleted}
                endReason={conversationEndReason}
                onStartNewChat={() => resetConversation()}
                sendMessage={sendMessage}
              />
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {selectedAgent &&
            !isChooserMode &&
            !(activeTab === "messages" && hasStarted) && (
            <motion.nav
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="px-6 pb-6 shrink-0"
            >
              <div className="glass-navbar rounded-2xl h-16 w-full flex items-center justify-around relative overflow-hidden">
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 w-10 h-0.5 blur-sm opacity-70"
                  style={{ backgroundColor: palette.primary }}
                  animate={{
                    left: activeTab === "home" ? "25%" : "75%",
                    translateX: "-50%",
                  }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />

                <button
                  onClick={() => setActiveTab("home")}
                  className={`flex flex-col items-center justify-center gap-0.5 w-1/2 h-full transition-colors relative z-10 ${
                    activeTab === "home"
                      ? "text-widget-primary"
                      : "text-widget-muted hover:text-widget-fg"
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[11px] font-medium">
                    {navLabelHome}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("messages")}
                  className={`flex flex-col items-center justify-center gap-0.5 w-1/2 h-full transition-colors relative z-10 ${
                    activeTab === "messages"
                      ? "text-widget-primary"
                      : "text-widget-muted hover:text-widget-fg"
                  }`}
                >
                  <div className="relative">
                    <MessageSquare className="w-5 h-5" />
                    {hasUnread && activeTab !== "messages" && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-widget-bg"
                        style={{ backgroundColor: palette.primary }}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-medium">
                    {navLabelMessages}
                  </span>
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
