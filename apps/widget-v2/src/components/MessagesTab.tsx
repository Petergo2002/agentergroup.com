import { motion } from "framer-motion";
import type {
  Message,
  WidgetAgentConfig,
  WidgetAttachment,
  WidgetConfig,
  WidgetEndChatReason,
} from "../types";
import { ChatView } from "./ChatView";

export interface MessagesTabProps {
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
  pendingAttachments?: WidgetAttachment[];
  isUploadingAttachment?: boolean;
  onAttachFile?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploadError?: string | null;
}

export function MessagesTab({
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
  pendingAttachments,
  isUploadingAttachment,
  onAttachFile,
  uploadError,
}: MessagesTabProps) {
  return (
    <motion.div
      key="messages"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.12 } }}
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden"
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatView
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
          endReason={endReason}
          onStartNewChat={onStartNewChat}
          sendMessage={sendMessage}
          pendingAttachments={pendingAttachments}
          isUploadingAttachment={isUploadingAttachment}
          onAttachFile={onAttachFile}
          uploadError={uploadError}
        />
      </div>
    </motion.div>
  );
}
