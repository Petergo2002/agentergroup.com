import { motion } from "framer-motion";
import { Copy, Send } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import type {
  Message,
  WidgetAgentConfig,
  WidgetConfig,
  WidgetEndChatReason,
} from "../types";

// Typing cursor component - Gemini style
function TypingCursor() {
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-widget-primary ml-1 align-middle animate-pulse" />
  );
}

const TRANSLATIONS = {
  en: {
    copy: "Copy",
    agentSubtext: "AI Agent",
    privacyText: "By sending a message, you acknowledge our ",
    privacyLink: "privacy policy",
    automatedWarning: "Chat messages may be processed automatically.",
    completedBanner: "This chat has ended.",
    completedTimeout: "The chat ended after inactivity.",
    completedButton: "Start a new chat",
    completedPlaceholder: "Start a new chat to continue",
  },
  sv: {
    copy: "Kopiera",
    agentSubtext: "AI-Agent",
    privacyText: "När du skickar ett meddelande bekräftar du vår ",
    privacyLink: "integritetspolicy",
    automatedWarning: "Chattmeddelanden kan behandlas automatiskt.",
    completedBanner: "Den här chatten har avslutats.",
    completedTimeout: "Chatten avslutades efter inaktivitet.",
    completedButton: "Starta ny chatt",
    completedPlaceholder: "Starta en ny chatt för att fortsätta",
  },
};

function MessageActions({
  onCopy,
  language = "en",
}: {
  onCopy: () => void;
  language?: string;
}) {
  const t = TRANSLATIONS[language as keyof typeof TRANSLATIONS] || TRANSLATIONS.en;
  
  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={onCopy}
        className="widget-icon-button p-1.5 rounded-lg"
        title={t.copy}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

type ParsedBlock =
  | { type: "heading"; lines: string[] }
  | { type: "unordered"; lines: string[] }
  | { type: "ordered"; lines: string[] }
  | { type: "paragraph"; lines: string[] };

function renderInlineText(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segments.map((segment, index) => {
    const strongMatch = segment.match(/^\*\*(.+)\*\*$/);
    if (strongMatch) {
      return (
        <strong key={index} className="font-semibold text-widget-fg">
          {strongMatch[1]}
        </strong>
      );
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

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] || "").trim().match(/^[-*]\s+(.*)$/);
        if (!match?.[1]) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: "unordered", lines: items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] || "").trim().match(/^\d+[.)]\s+(.*)$/);
        if (!match?.[1]) break;
        items.push(match[1].trim());
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
        /^[-*]\s+/.test(nextLine) ||
        /^\d+[.)]\s+/.test(nextLine) ||
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
  if (isStreaming) {
    return (
      <div className="text-sm leading-6 text-widget-fg whitespace-pre-wrap break-words">
        {content}
        <TypingCursor />
      </div>
    );
  }

  const blocks = parseMessageBlocks(content);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5 text-sm leading-6 text-widget-fg break-words">
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          return (
            <h4
              key={blockIndex}
              className="text-[13px] font-semibold uppercase tracking-wide text-widget-muted"
            >
              {renderInlineText(block.lines[0] || "")}
            </h4>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul
              key={blockIndex}
              className="space-y-1.5 pl-5 list-disc marker:text-widget-primary"
            >
              {block.lines.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineText(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol
              key={blockIndex}
              className="space-y-1.5 pl-5 list-decimal marker:text-widget-primary"
            >
              {block.lines.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineText(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {renderInlineText(line)}
                {lineIndex < block.lines.length - 1 ? "\n" : ""}
              </Fragment>
            ))}
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
  hasStarted: boolean;
  isConversationCompleted: boolean;
  endReason: WidgetEndChatReason | null;
  onStartNewChat: () => void;
  sendMessage: (text?: string) => Promise<void>;
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
  hasStarted,
  isConversationCompleted,
  endReason,
  onStartNewChat,
  sendMessage,
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (isConversationCompleted) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--widget-primary)] px-4 py-3 text-[var(--widget-primary-fg)] shadow-sm">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words font-medium">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {/* Message Content — no avatar, full width */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <AgentMessageContent
                      content={msg.content}
                      isStreaming={msg.isStreaming}
                    />

                    {/* Subtext */}
                    {!msg.isStreaming && (
                      <div className="text-xs text-widget-muted">
                        {selectedAgent.label || t.agentSubtext} &bull; {t.agentSubtext}
                      </div>
                    )}

                    {/* Action buttons */}
                    {!msg.isStreaming && msg.content && (
                      <MessageActions
                        language={config.widget.language}
                        onCopy={() => copyToClipboard(msg.content)}
                      />
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
                {selectedAgent.label}
                {config.widget.language === "sv" ? " skriver..." : " is typing..."}
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Chat Input */}
      <div className="relative z-10 shrink-0 bg-[color:var(--widget-bg)]/96 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-2 backdrop-blur-sm peer group md:px-10 lg:px-14">
        <div className="relative mx-auto max-w-4xl">
          {isConversationCompleted && (
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
          )}
          <div className="widget-input-shell relative flex items-center rounded-2xl px-1.5 shadow-lg">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
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
            />
            <button
              onClick={() => sendMessage()}
              disabled={
                isConversationCompleted ||
                !input.trim() ||
                isLoading ||
                isStreaming
              }
              className="p-2.5 rounded-xl bg-transparent text-widget-muted hover:text-[var(--widget-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 mr-1"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          {(config.widget.showBranding ?? true) && (
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
          )}
        </div>
      </div>
    </div>
  );
}
