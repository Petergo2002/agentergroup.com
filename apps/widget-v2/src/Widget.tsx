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
  getWidgetConfig,
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
  WidgetConfig,
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
type WidgetContextHeader = "embedded" | "hosted";

interface WidgetStateMessagePayload {
  type: typeof WIDGET_STATE_MESSAGE_TYPE;
  isOpen: boolean;
  at?: number;
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



function normalizeWidgetConfig(config: WidgetConfig): WidgetConfig {
  const language = resolveWidgetLanguage(config);

  const normalizedAgents = Array.isArray(config.agents)
    ? config.agents
        .map((agent) => {
          if (!agent || typeof agent !== "object") {
            return null;
          }

          return {
            widgetAgentId: String(agent.widgetAgentId ?? "").trim(),
            agentId: String(agent.agentId ?? "").trim(),
            label: agent.label?.trim() || (language === "sv" ? "AI-Agent" : "AI Agent"),
            description: agent.description?.trim() || "",
            icon:
              typeof agent.icon === "string" && agent.icon.trim()
                ? agent.icon.trim()
                : null,
            interactionMode: "chat",
            greeting: (agent.greeting?.trim() === "Hi! How can I help you today?" && language === "sv") ? "Hej! Hur kan jag hjälpa dig idag?" : (agent.greeting?.trim() || (language === "sv" ? "Hej! Hur kan jag hjälpa dig idag?" : "Hi! How can I help you today?")),
            placeholder: (agent.placeholder?.trim() === "Write a message..." && language === "sv") ? "Skriv ett meddelande..." : (agent.placeholder?.trim() || (language === "sv" ? "Skriv ett meddelande..." : "Write a message...")),
            quickActions: Array.isArray(agent.quickActions)
              ? agent.quickActions
              : [],
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
      title: (config.home?.title?.trim() === "How can we help?" && language === "sv") ? "Hur kan vi hjälpa till?" : (config.home?.title?.trim() || (language === "sv" ? "Hur kan vi hjälpa till?" : "How can we help?")),
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
  throw new Error(
    typeof payload?.error === "string" ? payload.error : fallback,
  );
}

export default function Widget({
  widgetPublicKey,
  previewMode = false,
  previewSource,
  parentOrigin,
  previewToken,
  previewRevision,
}: WidgetProps) {
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
  const [isWidgetOpen, setIsWidgetOpen] = useState(() =>
    typeof window !== "undefined" ? window.parent === window : true,
  );
  const [previewRevisionKey, setPreviewRevisionKey] = useState(
    previewRevision || "0",
  );
  const widgetContext: WidgetContextHeader =
    typeof window !== "undefined" && window.parent !== window
      ? "embedded"
      : "hosted";
  const embeddedParentOrigin =
    widgetContext === "embedded"
      ? resolveEmbeddedParentOrigin(parentOrigin)
      : null;
  const { sessionId, reset: resetWidgetSession } = useSession(widgetPublicKey, {
    persist: !previewMode,
  });
  const sessionEventDedupRef = useRef<Record<string, number>>({});
  const previousWidgetOpenRef = useRef<boolean | null>(null);

  const requestContext = useMemo<WidgetRequestContext>(
    () => ({
      widgetContext,
      parentOrigin: embeddedParentOrigin,
      previewToken: previewMode ? previewToken : undefined,
      previewSource:
        previewMode ? previewSource || "widget_preview" : undefined,
      previewRevision: previewMode ? previewRevisionKey : undefined,
    }),
    [
      embeddedParentOrigin,
      previewMode,
      previewRevisionKey,
      previewSource,
      previewToken,
      widgetContext,
    ],
  );

  const selectedAgent = useMemo(
    () => resolveSelectedAgent(config, selectedWidgetAgentId),
    [config, selectedWidgetAgentId],
  );

  const resetConversation = useCallback(
    (nextPreviewRevision?: string | number) => {
      resetWidgetSession();
      setMessages([]);
      setHasStarted(false);
      setInput("");
      setIsLoading(false);
      setIsStreaming(false);
      setHasUnread(false);
      setActiveTab("home");
      setError(null);
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
    [config, previewMode, resetWidgetSession],
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

    let cancelled = false;

    async function fetchConfig() {
      try {
        const nextConfig = normalizeWidgetConfig(
          await getWidgetConfig(widgetPublicKey, requestContext),
        );
        if (!cancelled) {
          setConfig(nextConfig);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          console.error("Failed to fetch widget config:", nextError);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Could not load widget",
          );
        }
      }
    }

    void fetchConfig();

    return () => {
      cancelled = true;
    };
  }, [requestContext, widgetPublicKey]);

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

    if (!text.trim()) {
      return;
    }

    if (isLoading || isStreaming || !widgetPublicKey || !activeAgent) {
      return;
    }

    if (!hasStarted) setHasStarted(true);
    setActiveTab("messages");

    const userMessage = text.trim();
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

      flushRendered(true);
      updateAssistantMessage(
        fullText || "Sorry, something went wrong. Please try again.",
        false,
      );
      setIsStreaming(false);
    } catch (nextError) {
      console.error("Chat error:", nextError);
      setMessages((previous) =>
        applyStreamFailureToMessages(
          previous,
          nextError instanceof Error
            ? nextError.message
            : "Sorry, something went wrong. Please try again.",
        ),
      );
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

      <div className="relative z-10 flex flex-col h-full">
        <header className="relative flex items-center justify-between px-6 pt-12 pb-4 shrink-0">
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
              {/* Brand logo - Vite widget, not a Next.js app */}
              <img // eslint-disable-line jsx-a11y/img-redundant-alt
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

          <div className="absolute inset-x-0 top-[3.75rem] flex justify-center pointer-events-none select-none z-0">
            <span
              className="text-widget-fg opacity-40 text-xs font-semibold tracking-[0.25em] uppercase"
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
            {widgetContext === "embedded" ? (
              <button
                onClick={handleClose}
                className="text-widget-muted hover:text-widget-fg transition-colors p-2"
                aria-label={widgetLanguage === "sv" ? "Stäng" : "Close"}
              >
                <X className="w-6 h-6" />
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
                selectedAgent={selectedAgent}
                messages={messages}
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                isStreaming={isStreaming}
                hasStarted={hasStarted}
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
