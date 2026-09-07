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
import { useWidgetViewportUnit } from "./hooks/useWidgetViewportUnit";
import {
  completeWidgetSession as requestWidgetSessionCompletion,
  getWidgetBootstrap,
  sendWidgetEvent,
  sendWidgetMessage,
  uploadWidgetAttachment,
  type WidgetRequestContext,
} from "./lib/api";
import { createJsonError, hasErrorCode, getRetryAfterSeconds, buildRequestContextFromBootstrap } from "./lib/api-errors";
import { buildChatRateLimitMessage } from "./lib/localization";
import { normalizeWidgetConfig, resolveWidgetLanguage, resolveSelectedAgent } from "./lib/config";
import { widgetDebug } from "./lib/debug";
import { buildLocalizedPrivacyPolicyUrl } from "./lib/localization";
import {
  PREVIEW_REQUEST_MESSAGE_TYPE,
  BOOTSTRAP_REQUEST_MESSAGE_TYPE,
  BOOTSTRAP_REFRESH_MESSAGE_TYPE,
  WIDGET_CLOSE_REQUEST_MESSAGE_TYPE,
  type SessionPresenceEvent,
  parsePreviewOverrideMessage,
  parsePreviewAuthUpdateMessage,
  parseWidgetStateMessage,
  parsePreviewResetMessage,
  parseWidgetBootstrapMessage,
  parseWidgetBootstrapErrorMessage,
} from "./lib/postmessage";
import { resolveEmbeddedParentOrigin } from "./lib/origin";
import {
  applyStreamFailureToMessages,
  getWidgetStreamCompletionError,
  parseWidgetStreamEvent,
  resolveStreamedAgentContent,
  shouldRevealInterimStreamContent,
} from "./lib/streaming";
import { deriveWidgetPalette, hexToRgb } from "./theme";
import type {
  Message,
  WidgetAttachment,
  WidgetBootstrapResponse,
  WidgetConfig,
  WidgetEndChatReason,
} from "./types";

interface WidgetProps {
  widgetPublicKey: string;
  previewMode?: boolean;
  previewSource?: string;
  parentOrigin?: string;
  previewToken?: string;
  previewRevision?: string;
  embeddedBy?: string;
}

const MIN_INTERIM_STREAM_RENDER_DELAY_MS = 0;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PRESENCE_DEDUPE_MS = 1_500;

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export default function Widget({
  widgetPublicKey,
  previewMode = false,
  previewSource,
  parentOrigin,
  previewToken,
  previewRevision,
  embeddedBy,
}: WidgetProps) {
  const isEmbedded =
    typeof window !== "undefined" && window.parent !== window;
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const configRef = useRef<WidgetConfig | null>(null);
  const [selectedWidgetAgentId, setSelectedWidgetAgentId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<WidgetAttachment[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "messages">("home");
  const [hasUnread, setHasUnread] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConversationCompleted, setIsConversationCompleted] = useState(false);
  const [conversationEndReason, setConversationEndReason] =
    useState<WidgetEndChatReason | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(() =>
    typeof window !== "undefined" ? window.parent === window : true,
  );
  const [previewRevisionKey, setPreviewRevisionKey] = useState(
    previewRevision || "0",
  );
  const [previewTokenKey, setPreviewTokenKey] = useState(previewToken);
  const embeddedParentOrigin = isEmbedded
    ? resolveEmbeddedParentOrigin(parentOrigin)
    : null;
  const { sessionId, reset: resetWidgetSession } = useSession(widgetPublicKey, {
    persist: !previewMode,
  });
  const sessionEventDedupRef = useRef<Record<string, number>>({});
  const previousWidgetOpenRef = useRef<boolean | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const bootstrapRefreshPromiseRef = useRef<Promise<WidgetBootstrapResponse> | null>(null);
  const activeStreamAbortControllerRef = useRef<AbortController | null>(null);
  useWidgetViewportUnit();

  const bootstrapContext = useMemo<WidgetRequestContext>(
    () => ({
      previewToken: previewMode ? previewTokenKey : undefined,
      previewSource:
        previewMode ? previewSource || "widget_preview" : undefined,
      previewRevision: previewMode ? previewRevisionKey : undefined,
    }),
    [
      previewMode,
      previewRevisionKey,
      previewSource,
      previewTokenKey,
    ],
  );

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    setPreviewTokenKey(previewToken);
  }, [previewToken]);
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
    setError(null);
  }, []);

  const requestEmbeddedBootstrapRefresh = useCallback(() => {
    return new Promise<WidgetBootstrapResponse>((resolve, reject) => {
      if (window.parent === window || !embeddedParentOrigin) {
        reject(
          new Error("Could not refresh the embedded widget session. Please try again."),
        );
        return;
      }

      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", handleRefreshMessage);
        reject(new Error("Timed out while refreshing the widget session."));
      }, 5000);

      function cleanup() {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleRefreshMessage);
      }

      function handleRefreshMessage(event: MessageEvent) {
        if (event.source !== window.parent || event.origin !== embeddedParentOrigin) {
          return;
        }

        const bootstrap = parseWidgetBootstrapMessage(event.data);
        if (bootstrap) {
          cleanup();
          resolve(bootstrap.payload);
          return;
        }

        const bootstrapError = parseWidgetBootstrapErrorMessage(event.data);
        if (bootstrapError) {
          cleanup();
          reject(new Error(bootstrapError.error));
        }
      }

      window.addEventListener("message", handleRefreshMessage);
      window.parent.postMessage(
        { type: BOOTSTRAP_REFRESH_MESSAGE_TYPE },
        embeddedParentOrigin,
      );
    });
  }, [embeddedParentOrigin]);

  const refreshWidgetAccess = useCallback(async () => {
    if (previewMode) {
      return requestContext;
    }

    if (bootstrapRefreshPromiseRef.current) {
      const payload = await bootstrapRefreshPromiseRef.current;
      return buildRequestContextFromBootstrap(bootstrapContext, payload);
    }

    const refreshPromise = (async () => {
      if (isEmbedded) {
        return requestEmbeddedBootstrapRefresh();
      }

      return getWidgetBootstrap(widgetPublicKey, bootstrapContext);
    })();

    bootstrapRefreshPromiseRef.current = refreshPromise;

    try {
      const payload = await refreshPromise;
      applyBootstrapPayload(payload);
      return buildRequestContextFromBootstrap(bootstrapContext, payload);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not refresh the widget session. Please try again.",
      );
    } finally {
      if (bootstrapRefreshPromiseRef.current === refreshPromise) {
        bootstrapRefreshPromiseRef.current = null;
      }
    }
  }, [
    applyBootstrapPayload,
    bootstrapContext,
    isEmbedded,
    previewMode,
    requestContext,
    requestEmbeddedBootstrapRefresh,
    widgetPublicKey,
  ]);

  const completeSessionWithRetry = useCallback(
    async (body: { sessionId: string; reason: "inactivity_timeout" }) => {
      let activeContext = requestContext;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await requestWidgetSessionCompletion(
            widgetPublicKey,
            body,
            activeContext,
          );
        } catch (error) {
          if (attempt === 0 && hasErrorCode(error, "WIDGET_ACCESS_TOKEN_INVALID")) {
            activeContext = await refreshWidgetAccess();
            continue;
          }

          throw error;
        }
      }

      throw new Error("Failed to complete the widget session.");
    },
    [refreshWidgetAccess, requestContext, widgetPublicKey],
  );

  const sendMessageRequestWithRetry = useCallback(
    async (
      body: {
        sessionId: string;
        message: string;
        widgetAgentId?: string;
        language: "sv" | "en";
        pageUrl?: string;
        referrer?: string;
        attachments?: {
          id: string;
          url: string;
          name: string;
          type: string;
          size: number;
        }[];
      },
      options?: { signal?: AbortSignal },
    ) => {
      let activeContext = requestContext;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await sendWidgetMessage(
          widgetPublicKey,
          body,
          activeContext,
          options,
        );

        if (response.ok) {
          return response;
        }

        const error = await createJsonError(response, "Failed to get response.");

        if (attempt === 0 && error.code === "WIDGET_ACCESS_TOKEN_INVALID") {
          activeContext = await refreshWidgetAccess();
          continue;
        }

        throw error;
      }

      throw new Error("Failed to send widget message.");
    },
    [refreshWidgetAccess, requestContext, widgetPublicKey],
  );

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
        void completeSessionWithRetry({
          sessionId,
          reason: "inactivity_timeout",
        })
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
            widgetDebug.error("Failed to complete inactive chat:", nextError);
          });
      }, timeoutSeconds * 1000);
    },
    [
      clearInactivityTimer,
      completeSessionWithRetry,
      markConversationCompleted,
      sessionId,
    ],
  );

  const resetConversation = useCallback(
    (nextPreviewRevision?: string | number) => {
      if (activeStreamAbortControllerRef.current) {
        activeStreamAbortControllerRef.current.abort();
        activeStreamAbortControllerRef.current = null;
      }
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
      const currentConfig = configRef.current;
      setSelectedWidgetAgentId(
        currentConfig?.home.mode === "single_auto"
          ? currentConfig.agents[0]?.widgetAgentId ?? null
          : null,
      );

      if (!previewMode) return;
      const fallbackRevision = `${Date.now()}`;
      setPreviewRevisionKey(
        nextPreviewRevision !== undefined
          ? String(nextPreviewRevision)
          : fallbackRevision,
      );
    },
    [clearInactivityTimer, previewMode, resetWidgetSession],
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
      if (previewMode) return;
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
    [previewMode, requestContext, sessionId, widgetPublicKey],
  );

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
          widgetDebug.error("Failed to bootstrap widget:", nextError);
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
      if (activeStreamAbortControllerRef.current) {
        activeStreamAbortControllerRef.current.abort();
        activeStreamAbortControllerRef.current = null;
      }
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

      const authUpdate = parsePreviewAuthUpdateMessage(event.data);
      if (authUpdate) {
        setPreviewTokenKey(authUpdate.payload.previewToken);
        if (authUpdate.payload.previewRevision !== undefined) {
          setPreviewRevisionKey(authUpdate.payload.previewRevision);
        }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB");
      return;
    }
    
    try {
      setIsUploadingAttachment(true);
      setError(null);
      const attachment = await uploadWidgetAttachment(widgetPublicKey, sessionId, file, requestContext);
      setPendingAttachments(prev => [...prev, attachment]);
    } catch (err) {
      widgetDebug.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const sendMessage = async (text: string = input) => {
    const activeLanguage = resolveWidgetLanguage(config);
    const activeAgent = resolveSelectedAgent(config, selectedWidgetAgentId);
    const activeEndChatPolicy =
      activeAgent?.interactionMode === "chat"
        ? activeAgent.endChatPolicy
        : null;
    const trimmedMessage = text.trim();

    if (!trimmedMessage && pendingAttachments.length === 0) {
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
    const currentAttachments = [...pendingAttachments];
    setInput("");
    setPendingAttachments([]);
    setUploadError(null);
    setMessages((previous) => [
      ...previous,
      { role: "user", content: userMessage, attachments: currentAttachments.length > 0 ? currentAttachments : undefined },
    ]);
    setIsLoading(true);
    const streamAbortController = new AbortController();
    activeStreamAbortControllerRef.current = streamAbortController;

    try {
      const response = await sendMessageRequestWithRetry({
        sessionId,
        message: userMessage,
        widgetAgentId: activeAgent.widgetAgentId,
        language: activeLanguage,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        pageUrl:
          typeof window !== "undefined" ? window.location.href : undefined,
        referrer:
          typeof document !== "undefined" ? document.referrer : undefined,
      }, { signal: streamAbortController.signal });

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
        const event = parseWidgetStreamEvent(data);
        switch (event.type) {
          case "done":
            streamDone = true;
            return;
          case "error": {
            const nextStreamError = new Error(event.message) as Error & {
              code?: string;
            };
            nextStreamError.code = event.code;
            streamError = nextStreamError;
            streamDone = true;
            return;
          }
          case "session-completed":
            streamCompleted = true;
            streamEndReason = event.endReason;
            markConversationCompleted(streamEndReason);
            return;
          case "delta":
            fullText += event.content;
            scheduleRenderedFlush();
            return;
          case "content":
            fullText = event.content;
            scheduleRenderedFlush();
            return;
          case "noop":
            return;
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

      const completionError = getWidgetStreamCompletionError({
        receivedDoneEvent: streamDone,
        content: fullText,
      });
      if (completionError) {
        throw new Error(completionError);
      }

      flushRendered(true);
      updateAssistantMessage(fullText, false);
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
      if (isAbortError(nextError)) {
        return;
      }

      if (hasErrorCode(nextError, "RATE_LIMITED_CHAT")) {
        setMessages((previous) =>
          applyStreamFailureToMessages(
            previous,
            buildChatRateLimitMessage(
              activeLanguage,
              getRetryAfterSeconds(nextError),
            ),
          ),
        );
        setIsStreaming(false);
        return;
      }

      widgetDebug.error("Chat error:", nextError);
      const isSessionCompletedError = hasErrorCode(nextError, "SESSION_COMPLETED");

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
      if (activeStreamAbortControllerRef.current === streamAbortController) {
        activeStreamAbortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const widgetLanguage = config ? resolveWidgetLanguage(config) : "en";
  const isChooserMode =
    config?.home.mode === "chooser" && selectedAgent === null;
  const navLabelHome = widgetLanguage === "sv" ? "Hem" : "Home";
  const navLabelMessages = widgetLanguage === "sv" ? "Meddelanden" : "Messages";
  const newChatLabel = widgetLanguage === "sv" ? "Starta ny chatt" : "Start a new chat";
  const showStandaloneDesktopShell = !isEmbedded;
  const showSurfaceNav =
    Boolean(selectedAgent) &&
    !isChooserMode &&
    !(activeTab === "messages" && hasStarted);



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
  const palette = deriveWidgetPalette(
    config.widget.primaryColor,
    config.widget.secondaryColor,
    themeMode,
  );
  const rgb = hexToRgb(palette.accentStrong);
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
          "--widget-brand-primary": palette.primary,
          "--widget-milo-color": palette.accentStrong,
          "--widget-primary": palette.accentStrong,
          "--widget-secondary": palette.secondary,
          "--widget-primary-rgb": primaryRgb,
          "--widget-primary-fg": palette.accentStrongFg,
          "--widget-muted": palette.muted,
          "--widget-accent-soft": palette.accentSoft,
          "--widget-state-hover": palette.stateHover,
          "--widget-state-selected": palette.stateSelected,
          "--widget-state-selected-border": palette.stateSelectedBorder,
          "--widget-state-selected-text": palette.stateSelectedText,
          "--widget-state-selected-icon": palette.stateSelectedIcon,
          "--widget-focus-ring": palette.focusRing,
          "--widget-input-surface": palette.inputSurface,
          "--widget-input-surface-hover": palette.inputSurfaceHover,
          "--widget-input-border-focus": palette.inputBorderFocus,
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
        className="relative z-10 flex h-full w-full flex-col overflow-hidden"
      >
        {/* Top Hero Gradient using Secondary Color (only on home tab) */}
        {activeTab === "home" && (
          <div 
            className="absolute top-0 left-0 right-0 h-[45%] pointer-events-none z-0"
            style={{
              background: `linear-gradient(to bottom, var(--widget-secondary) 0%, transparent 100%)`,
              opacity: themeMode === "dark" ? 0.40 : 0.30
            }}
          />
        )}

        <header
          className={`relative flex items-center justify-between px-6 pb-4 pt-[calc(env(safe-area-inset-top,0px)+3rem)] shrink-0 ${
            showStandaloneDesktopShell
              ? "lg:border-b lg:border-[var(--widget-border)] lg:px-10 lg:pb-5 lg:pt-10"
              : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {(activeTab === "home" && selectedAgent && config.home.mode === "chooser" && !hasStarted) && (
                <motion.button
                  key="back-button"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => setSelectedWidgetAgentId(null)}
                  className="widget-icon-button mr-1 p-1"
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
            className="absolute inset-x-0 top-[3.75rem] flex justify-center pointer-events-none select-none z-0"
          >
            <span
              className="block text-center font-semibold uppercase text-widget-fg opacity-40 text-[10px] tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em] truncate"
              style={{
                maxWidth: "min(220px, calc(100% - 5rem))",
                textShadow:
                  themeMode === "dark"
                    ? "0px 1px 1px rgba(255,255,255,0.05), 0px -1px 1px rgba(0,0,0,0.4)"
                    : "0px 1px 1px rgba(255,255,255,0.8), 0px -1px 0.5px rgba(0,0,0,0.1)",
              }}
            >
              {config.brand.name || "Avenro"}
            </span>
          </div>

          <div className={`flex items-center gap-3 ${embeddedBy === "loader" ? "pr-[60px] sm:pr-0" : ""}`}>
            {showStandaloneDesktopShell && showSurfaceNav ? (
              <div className="hidden lg:flex items-center rounded-full border border-[var(--widget-border)] bg-[color:var(--widget-input-surface)] p-1 shadow-sm">
                <button
                  onClick={() => setActiveTab("home")}
                  data-active={activeTab === "home" ? "true" : "false"}
                  className="widget-nav-button rounded-full px-4 py-2 text-xs font-semibold"
                  style={activeTab === "home" ? { color: palette.secondary } : undefined}
                >
                  {navLabelHome}
                </button>
                <button
                  onClick={() => setActiveTab("messages")}
                  data-active={activeTab === "messages" ? "true" : "false"}
                  className="widget-nav-button rounded-full px-4 py-2 text-xs font-semibold"
                  style={activeTab === "messages" ? { color: palette.secondary } : undefined}
                >
                  {navLabelMessages}
                </button>
              </div>
            ) : null}
            {hasStarted && (
              <button
                onClick={() => resetConversation()}
                disabled={isLoading || isStreaming}
                className="widget-icon-button p-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={newChatLabel}
                title={newChatLabel}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            {isEmbedded ? (
              <button
                onClick={handleClose}
                className={`widget-icon-button p-2 ${embeddedBy === "loader" ? "hidden sm:flex" : ""}`}
                aria-label={widgetLanguage === "sv" ? "Stäng" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-hidden">
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
                pendingAttachments={pendingAttachments}
                isUploadingAttachment={isUploadingAttachment}
                onAttachFile={handleFileUpload}
                uploadError={uploadError}
              />
            )}
          </AnimatePresence>
        </main>

        {config.widget.showBranding ? (
          <div className="shrink-0 px-6 pb-3 pt-2 text-center">
            <a
              href="https://avenro.se"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-widget-muted transition-colors hover:text-widget-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-widget-primary/40"
            >
              Powered by Avenro
            </a>
          </div>
        ) : null}

        <AnimatePresence>
          {selectedAgent &&
            !isChooserMode &&
            !(activeTab === "messages" && hasStarted) && (
            <motion.nav
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`px-6 pb-6 shrink-0 ${
                showStandaloneDesktopShell ? "lg:hidden" : ""
              }`}
            >
              <div className="glass-navbar rounded-2xl h-16 w-full flex items-center justify-around relative overflow-hidden">
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 w-10 h-0.5 blur-sm opacity-70"
                  style={{ backgroundColor: palette.stateSelectedIcon }}
                  animate={{
                    left: activeTab === "home" ? "25%" : "75%",
                    translateX: "-50%",
                  }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />

                <button
                  onClick={() => setActiveTab("home")}
                  data-active={activeTab === "home" ? "true" : "false"}
                  className="widget-nav-button relative z-10 flex h-full w-1/2 flex-col items-center justify-center gap-0.5 transition-colors duration-200"
                  style={activeTab === "home" ? { color: palette.secondary } : undefined}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[11px] font-medium">
                    {navLabelHome}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("messages")}
                  data-active={activeTab === "messages" ? "true" : "false"}
                  className="widget-nav-button relative z-10 flex h-full w-1/2 flex-col items-center justify-center gap-0.5 transition-colors duration-200"
                  style={activeTab === "messages" ? { color: palette.secondary } : undefined}
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
