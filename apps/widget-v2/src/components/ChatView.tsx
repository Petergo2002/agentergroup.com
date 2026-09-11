import { motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Paperclip,
  Send,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type {
  Message,
  WidgetAgentConfig,
  WidgetAttachment,
  WidgetConfig,
  WidgetEndChatReason,
  WidgetGenerativeUi,
} from "../types";
import { MiloMark } from "./MiloMark";

// Typing cursor component - Gemini style
function TypingCursor() {
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-widget-primary ml-1 align-middle animate-pulse" />
  );
}

const TRANSLATIONS = {
  en: {
    copy: "Copy",
    copied: "Copied",
    attachFile: "Attach file",
    sendMessage: "Send message",
    agentSubtext: "AI Agent",
    privacyText: "By sending a message, you acknowledge our ",
    privacyLink: "privacy policy",
    automatedWarning: "Chat messages may be processed automatically.",
    completedBanner: "This chat has ended.",
    completedTimeout: "The chat ended after inactivity.",
    completedButton: "Start a new chat",
    completedPlaceholder: "Start a new chat to continue",
    availableTimes: "Available times",
    chooseTime: "Choose a time to book",
    bookingConfirmed: "Meeting booked",
    openCalendar: "Open in calendar",
    joinMeeting: "Join meeting",
    phaseKnowledge: "Looking this up...",
    phaseThinking: "Thinking...",
    phaseTools: "Working on it...",
    phaseFinalizing: "Almost done...",
  },
  sv: {
    copy: "Kopiera",
    copied: "Kopierat",
    attachFile: "Bifoga fil",
    sendMessage: "Skicka meddelande",
    agentSubtext: "AI-Agent",
    privacyText: "När du skickar ett meddelande bekräftar du vår ",
    privacyLink: "integritetspolicy",
    automatedWarning: "Chattmeddelanden kan behandlas automatiskt.",
    completedBanner: "Den här chatten har avslutats.",
    completedTimeout: "Chatten avslutades efter inaktivitet.",
    completedButton: "Starta ny chatt",
    completedPlaceholder: "Starta en ny chatt för att fortsätta",
    availableTimes: "Lediga tider",
    chooseTime: "Välj en tid att boka",
    bookingConfirmed: "Mötet är bokat",
    openCalendar: "Öppna i kalendern",
    joinMeeting: "Anslut till mötet",
    phaseKnowledge: "Letar upp det...",
    phaseThinking: "Tänker...",
    phaseTools: "Jobbar på det...",
    phaseFinalizing: "Nästan klar...",
  },
};

function formatCalendarDateTime(value: string, timezone: string, language: string) {
  const locale = language === "sv" ? "sv-SE" : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(value));
  }
}

function CalendarGenerativeUi({
  ui,
  language,
  disabled,
  onSelectSlot,
}: {
  ui: WidgetGenerativeUi;
  language: string;
  disabled: boolean;
  onSelectSlot: (start: string, end: string) => void;
}) {
  const t = TRANSLATIONS[language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;

  if (ui.type === "calendar_booking_confirmation") {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-widget-fg">
              {t.bookingConfirmed}
            </p>
            {ui.title ? (
              <p className="mt-0.5 truncate text-xs font-medium text-widget-muted">
                {ui.title}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-widget-fg">
              {formatCalendarDateTime(ui.start, ui.timezone, language)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ui.calendarUrl ? (
                <a
                  href={ui.calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-widget-border bg-widget-card px-3 py-2 text-xs font-semibold text-widget-fg transition-colors hover:border-widget-primary/40"
                >
                  {t.openCalendar}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {ui.meetingUrl ? (
                <a
                  href={ui.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-widget-primary px-3 py-2 text-xs font-semibold text-widget-primary-fg transition-opacity hover:opacity-90"
                >
                  {t.joinMeeting}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-widget-border bg-widget-card/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-widget-primary/10 text-widget-primary">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-widget-fg">{t.availableTimes}</p>
          <p className="text-xs text-widget-muted">{t.chooseTime}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ui.slots.map((slot) => (
          <button
            key={`${slot.start}:${slot.end}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelectSlot(slot.start, slot.end)}
            className="rounded-xl border border-widget-border bg-widget-bg px-3 py-2.5 text-left text-sm font-semibold text-widget-fg transition-all hover:border-widget-primary/50 hover:bg-widget-primary/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formatCalendarDateTime(slot.start, ui.timezone, language)}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageActions({
  onCopy,
  language = "en",
}: {
  onCopy: () => Promise<boolean>;
  language?: string;
}) {
  const t = TRANSLATIONS[language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    const didCopy = await onCopy();
    if (!didCopy) return;

    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1600);
  };
  
  return (
    <div className="mt-2 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`widget-icon-button rounded-lg p-1.5 transition-colors ${
          copied ? "text-emerald-600" : ""
        }`}
        aria-label={copied ? t.copied : t.copy}
        title={copied ? t.copied : t.copy}
        aria-live="polite"
      >
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="block"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </motion.span>
      </button>
    </div>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based fallback for restricted iframes.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

type ParsedBlock =
  | { type: "heading"; lines: string[] }
  | { type: "unordered"; lines: string[] }
  | { type: "ordered"; lines: string[] }
  | { type: "paragraph"; lines: string[] };

function renderInlineText(text: string, isStreaming?: boolean) {
  const segments = text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean);
  return segments.map((segment, index) => {
    const strongMatch = segment.match(/^\*\*(.+)\*\*$/);
    if (strongMatch) {
      return (
        <strong key={index} className="font-semibold text-widget-fg">
          {strongMatch[1]}
        </strong>
      );
    }

    const codeMatch = segment.match(/^`([^`]+)`$/);
    if (codeMatch) {
      return (
        <code
          key={index}
          className="rounded bg-widget-surface px-1.5 py-0.5 font-mono text-[12px] text-widget-fg ring-1 ring-widget-border"
        >
          {codeMatch[1]}
        </code>
      );
    }

    const linkMatch = segment.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-widget-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (isStreaming && index === segments.length - 1) {
      const partialBold = segment.match(/^\*\*([^*]+)$/);
      if (partialBold) {
        return (
          <strong key={index} className="font-semibold text-widget-fg">
            {partialBold[1]}
          </strong>
        );
      }
      const partialCode = segment.match(/^`([^`]+)$/);
      if (partialCode) {
        return (
          <code
            key={index}
            className="rounded bg-widget-surface px-1.5 py-0.5 font-mono text-[12px] text-widget-fg ring-1 ring-widget-border"
          >
            {partialCode[1]}
          </code>
        );
      }
      const partialLink = segment.match(/^\[([^\]]+)\]\(([^)]*)$/);
      if (partialLink) {
        return (
          <span
            key={index}
            className="font-medium text-widget-primary underline underline-offset-2"
          >
            {partialLink[1]}
          </span>
        );
      }
    }

    return <Fragment key={index}>{segment}</Fragment>;
  });
}

function parseMessageBlocks(content: string): ParsedBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] || "";
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    const mdHeadingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (mdHeadingMatch) {
      blocks.push({
        type: "heading",
        lines: [mdHeadingMatch[1].trim()],
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s*/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] || "").trim().match(/^[-*]\s*(.*)$/);
        if (!match) break;
        items.push(match[1]?.trim() || "");
        index += 1;
      }
      blocks.push({ type: "unordered", lines: items });
      continue;
    }

    if (/^\d+[.)]\s*/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] || "").trim().match(/^\d+[.)]\s*(.*)$/);
        if (!match) break;
        items.push(match[1]?.trim() || "");
        index += 1;
      }
      blocks.push({ type: "ordered", lines: items });
      continue;
    }

    if (/^[^:#\n]{2,64}:\s*$/.test(line)) {
      blocks.push({
        type: "heading",
        lines: [line.replace(/:\s*$/, "")],
      });
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = (lines[index] || "").trim();
      if (!nextLine) {
        index += 1;
        break;
      }
      if (
        /^[-*]\s*/.test(nextLine) ||
        /^\d+[.)]\s*/.test(nextLine) ||
        /^#{1,6}\s+/.test(nextLine) ||
        /^[^:#\n]{2,64}:\s*$/.test(nextLine)
      ) {
        break;
      }
      paragraph.push(nextLine);
      index += 1;
    }

    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

function AgentMessageContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const blocks = parseMessageBlocks(content);

  if (blocks.length === 0) {
    return isStreaming ? <TypingCursor /> : null;
  }

  return (
    <div className="space-y-2.5 text-sm leading-6 text-widget-fg break-words">
      {blocks.map((block, blockIndex) => {
        const isLastBlock = blockIndex === blocks.length - 1;

        if (block.type === "heading") {
          return (
            <h4
              key={blockIndex}
              className="text-[13px] font-semibold uppercase tracking-wide text-widget-muted"
            >
              {renderInlineText(block.lines[0] || "", isStreaming && isLastBlock)}
              {isStreaming && isLastBlock ? <TypingCursor /> : null}
            </h4>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul
              key={blockIndex}
              className="space-y-1.5 pl-5 list-disc marker:text-widget-primary"
            >
              {block.lines.map((item, itemIndex) => {
                const isLastItem = isLastBlock && itemIndex === block.lines.length - 1;
                return (
                  <li key={itemIndex}>
                    {renderInlineText(item, isStreaming && isLastItem)}
                    {isStreaming && isLastItem ? <TypingCursor /> : null}
                  </li>
                );
              })}
            </ul>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol
              key={blockIndex}
              className="space-y-1.5 pl-5 list-decimal marker:text-widget-primary"
            >
              {block.lines.map((item, itemIndex) => {
                const isLastItem = isLastBlock && itemIndex === block.lines.length - 1;
                return (
                  <li key={itemIndex}>
                    {renderInlineText(item, isStreaming && isLastItem)}
                    {isStreaming && isLastItem ? <TypingCursor /> : null}
                  </li>
                );
              })}
            </ol>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => {
              const isLastLine = isLastBlock && lineIndex === block.lines.length - 1;
              return (
                <Fragment key={lineIndex}>
                  {renderInlineText(line, isStreaming && isLastLine)}
                  {isStreaming && isLastLine ? <TypingCursor /> : null}
                  {lineIndex < block.lines.length - 1 ? "\n" : ""}
                </Fragment>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

interface ChatViewProps {
  config: WidgetConfig;
  privacyPolicyUrl?: string | null;
  selectedAgent: WidgetAgentConfig;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  streamPhase?: string | null;
  hasStarted: boolean;
  isConversationCompleted: boolean;
  endReason: WidgetEndChatReason | null;
  onStartNewChat: () => void;
  sendMessage: (text?: string) => Promise<void>;
  pendingAttachments?: WidgetAttachment[];
  isUploadingAttachment?: boolean;
  onAttachFile?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploadError?: string | null;
}

export function ChatView({
  config,
  privacyPolicyUrl,
  selectedAgent,
  messages,
  input,
  setInput,
  isLoading,
  isStreaming,
  streamPhase,
  hasStarted,
  isConversationCompleted,
  endReason,
  onStartNewChat,
  sendMessage,
  pendingAttachments,
  isUploadingAttachment,
  onAttachFile,
  uploadError,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[config.widget.language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;

  // Auto-scroll to bottom
  useEffect(() => {
    if (hasStarted && chatContainerRef.current) {
      const scrollContainer = chatContainerRef.current;
      const behavior: ScrollBehavior = isStreaming ? "auto" : "smooth";
      requestAnimationFrame(() => {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior,
        });
      });
    }
  }, [messages, hasStarted, isLoading, isStreaming]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isConversationCompleted) {
      void sendMessage();
    }
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 120);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 widget-scroll touch-pan-y"
      >
        <div className="mx-auto max-w-4xl space-y-6 pb-4">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group"
            >
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] flex flex-col gap-2">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-col gap-1 items-end">
                        {msg.attachments.map((att, i) => (
                          att.type.startsWith("image/") ? (
                            // The widget app is built with Vite, so `next/image` is not available here.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={att.url}
                              alt={att.name}
                              className="max-w-[200px] rounded-lg shadow-sm object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-widget-card border border-widget-border rounded-lg px-3 py-2 text-xs text-widget-fg hover:bg-widget-border/30 transition-colors shadow-sm">
                              <Paperclip className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                            </a>
                          )
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div className="self-end rounded-2xl rounded-br-sm bg-[var(--widget-primary)] px-4 py-3 text-[var(--widget-primary-fg)] shadow-sm">
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words font-medium">
                          {msg.content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {/* Message Content — no avatar, full width */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {msg.isStreaming && !msg.content && streamPhase ? (
                      <motion.p
                        key={streamPhase}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[13px] italic text-widget-muted"
                      >
                        {t[
                          `phase${streamPhase.charAt(0).toUpperCase()}${streamPhase.slice(1)}` as keyof typeof t
                        ] ?? t.phaseThinking}
                      </motion.p>
                    ) : null}

                    <AgentMessageContent
                      content={msg.content}
                      isStreaming={msg.isStreaming}
                    />

                    {msg.ui ? (
                      <CalendarGenerativeUi
                        ui={msg.ui}
                        language={config.widget.language ?? "en"}
                        disabled={isLoading || isStreaming || isConversationCompleted}
                        onSelectSlot={(start, end) => {
                          const prompt =
                            config.widget.language === "sv"
                              ? `Boka mötestiden som börjar ${start} och slutar ${end}.`
                              : `Book the meeting slot that starts at ${start} and ends at ${end}.`;
                          void sendMessage(prompt);
                        }}
                      />
                    ) : null}

                    {/* Milo conversation identity and actions */}
                    {!msg.isStreaming && (
                      <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5 text-xs text-widget-muted">
                          <MiloMark className="h-4 w-4" />
                          <span>
                            <span className="font-semibold text-widget-fg">Milo</span>{" "}
                            <span aria-hidden="true">&bull;</span>{" "}
                            {t.agentSubtext}
                          </span>
                        </div>

                        {msg.content && (
                          <MessageActions
                            language={config.widget.language}
                            onCopy={() => copyTextToClipboard(msg.content)}
                          />
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {/* Typing indicator — premium minimal style */}
          {isLoading && messages[messages.length - 1]?.role !== "agent" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 pl-1"
            >
              <MiloMark className="h-4 w-4" />
              {/* Three dots with staggered fade-pulse */}
              <div className="flex items-center gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block w-[5px] h-[5px] rounded-full bg-widget-muted"
                    style={{
                      animation: "typingPulse 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.18}s`,
                    }}
                  />
                ))}
              </div>
              {/* Agent name + status */}
              <span className="text-[12px] text-widget-muted font-medium">
                Milo
                {config.widget.language === "sv" ? " skriver..." : " is typing..."}
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Chat Input */}
      <div className="relative z-10 shrink-0 bg-[var(--widget-bg)] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-2 peer group md:px-10 lg:px-14">
        <div className="relative mx-auto max-w-4xl">
          {uploadError && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500 shadow-sm border border-red-500/20">
              <span className="flex-1">{uploadError}</span>
            </div>
          )}
          {pendingAttachments && pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-1">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-widget-card border border-widget-border rounded-lg px-2 py-1 shadow-sm">
                  {att.type.startsWith("image/") ? (
                    // The widget app is built with Vite, so `next/image` is not available here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.url}
                      alt={att.name}
                      className="w-6 h-6 rounded object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Paperclip className="w-4 h-4 text-widget-muted" />
                  )}
                  <span className="text-xs font-medium text-widget-fg max-w-[120px] truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}
          {isConversationCompleted ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-widget-border bg-widget-card px-4 py-3 text-sm text-widget-fg">
              <div>
                <p className="font-medium">
                  {endReason === "inactivity_timeout"
                    ? t.completedTimeout
                    : t.completedBanner}
                </p>
              </div>
              <button
                onClick={onStartNewChat}
                className="rounded-xl bg-widget-primary px-3 py-2 text-xs font-semibold text-widget-primary-fg transition-opacity hover:opacity-90"
              >
                {t.completedButton}
              </button>
            </div>
          ) : null}
            <form
              onSubmit={handleSubmit}
              className="widget-input-shell relative flex items-center rounded-2xl px-1.5 shadow-lg"
            >
          {onAttachFile && (
            <label
              className={`p-2.5 rounded-xl bg-transparent text-widget-muted hover:text-[var(--widget-secondary)] transition-colors shrink-0 ml-1 ${
                isConversationCompleted || isLoading || isStreaming || isUploadingAttachment
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
              aria-label={t.attachFile}
              title={t.attachFile}
            >
              <input
                type="file"
                className="hidden"
                disabled={isConversationCompleted || isLoading || isStreaming || isUploadingAttachment}
                onChange={onAttachFile}
                accept="image/*,application/pdf,text/plain"
              />
              <Paperclip className={`w-5 h-5 ${isUploadingAttachment ? "animate-pulse" : ""}`} />
            </label>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleInputFocus}
            placeholder={
              isConversationCompleted
                ? t.completedPlaceholder
                : selectedAgent.placeholder || "Enter your message..."
            }
            disabled={isConversationCompleted}
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-widget-fg placeholder:text-widget-muted py-3 min-h-12 text-[15px] px-4 widget-chat-input"
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={
              isConversationCompleted ||
              (!input.trim() && (!pendingAttachments || pendingAttachments.length === 0)) ||
              isLoading ||
              isStreaming
            }
            className="p-2.5 rounded-xl bg-transparent text-widget-muted hover:text-[var(--widget-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 mr-1"
            aria-label={t.sendMessage}
            title={t.sendMessage}
          >
            <Send className="w-5 h-5" />
          </button>
            </form>

            <div className="mt-3 text-center">
              <p className="mx-auto max-w-2xl text-xs leading-5 text-widget-muted">
                {privacyPolicyUrl ? (
                  <>
                    {t.privacyText}
                    <a
                      href={privacyPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-widget-fg transition-colors"
                    >
                      {t.privacyLink}
                    </a>
                  </>
                ) : (
                  <>{t.automatedWarning}</>
                )}
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}
