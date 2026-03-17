import { motion } from "framer-motion";
import type { Message, WidgetAgentConfig, WidgetConfig } from "../types";
import { ChatView } from "./ChatView";

export interface MessagesTabProps {
  config: WidgetConfig;
  selectedAgent: WidgetAgentConfig;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  hasStarted: boolean;
  sendMessage: (text?: string) => Promise<void>;
}

export function MessagesTab({
  config,
  selectedAgent,
  messages,
  input,
  setInput,
  isLoading,
  isStreaming,
  hasStarted,
  sendMessage,
}: MessagesTabProps) {
  return (
    <motion.div
      key="messages"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="absolute inset-0 flex flex-col"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatView
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
      </div>
    </motion.div>
  );
}
