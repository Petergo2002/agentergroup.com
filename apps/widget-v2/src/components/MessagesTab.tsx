import { motion } from "framer-motion";
import type { Message, WidgetAgentConfig, WidgetConfig } from "../types";
import { ChatView } from "./ChatView";
import { ContactForm, type ContactFormProps } from "./ContactForm";

export interface MessagesTabProps
  extends Omit<
    ContactFormProps,
    "config" | "contactFormSettings" | "quotaFallbackActive"
  > {
  config: WidgetConfig;
  selectedAgent: WidgetAgentConfig;
  isContactFormMode: boolean;
  quotaFallbackActive: boolean;
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
  isContactFormMode,
  quotaFallbackActive,
  messages,
  input,
  setInput,
  isLoading,
  isStreaming,
  hasStarted,
  sendMessage,
  ...contactFormProps
}: MessagesTabProps) {
  return (
    <motion.div
      key="messages"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className="absolute inset-0 flex flex-col"
    >
      {isContactFormMode ? (
        <ContactForm
          config={config}
          contactFormSettings={{
            submitButtonText:
              selectedAgent.contactFormSettings?.submitButtonText ||
              (config.widget.language === "sv" ? "Skicka" : "Send"),
            successMessage:
              selectedAgent.contactFormSettings?.successMessage ||
              (config.widget.language === "sv"
                ? "Tack! Vi återkommer så snart vi kan."
                : "Thanks! We'll get back to you soon."),
            introText:
              selectedAgent.contactFormSettings?.introText ||
              (config.widget.language === "sv"
                ? "Lämna dina uppgifter så kontaktar vi dig."
                : "Leave your details and we'll contact you."),
          }}
          quotaFallbackActive={quotaFallbackActive}
          {...contactFormProps}
        />
      ) : (
        <div className="flex-1 flex flex-col min-h-0 relative">
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
      )}
    </motion.div>
  );
}
