import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, MessageSquare, Phone, Send, User } from "lucide-react";
import { useState } from "react";
import { submitWidgetLead, type WidgetRequestContext } from "../lib/api";
import { resolveWidgetLanguage } from "../lib/config";
import type { WidgetAgentConfig, WidgetConfig } from "../types";

export interface ContactTabProps {
  config: WidgetConfig;
  language?: "sv" | "en";
  selectedAgent: WidgetAgentConfig | null;
  sessionId: string;
  requestContext: WidgetRequestContext;
  palette: {
    primary: string;
    primaryFg: string;
    secondary: string;
    fg: string;
    muted: string;
  };
  onSwitchToChat: () => void;
}

const TRANSLATIONS = {
  sv: {
    title: "Kontakta oss",
    subtitle: "Lämna dina uppgifter så återkopplar vi så snart som möjligt.",
    nameLabel: "Ditt namn",
    namePlaceholder: "T.ex. Anna Andersson",
    phoneLabel: "Telefonnummer",
    phonePlaceholder: "070 123 45 67",
    emailLabel: "E-postadress",
    emailPlaceholder: "anna@foretag.se",
    messageLabel: "Vad gäller ärendet?",
    messagePlaceholder: "Beskriv kort vad du vill ha hjälp med...",
    submitBtn: "Skicka förfrågan",
    submittingBtn: "Skickar...",
    errorName: "Vänligen ange ditt namn.",
    errorEmail: "Vänligen ange en giltig e-postadress.",
    errorGeneral: "Kunde inte skicka förfrågan. Försök igen om en stund.",
    successTitle: "Tack för din förfrågan!",
    successDesc: "Vi har tagit emot dina uppgifter och återkopplar till dig så snart som möjligt.",
    sentDetailsTitle: "Mottagna uppgifter:",
    sendAnother: "Skicka en ny förfrågan",
    backToChat: "Gå tillbaka till chatten",
  },
  en: {
    title: "Contact Us",
    subtitle: "Leave your details and our team will get back to you as soon as possible.",
    nameLabel: "Your Name",
    namePlaceholder: "e.g. Alex Morgan",
    phoneLabel: "Phone Number",
    phonePlaceholder: "+46 70 123 45 67",
    emailLabel: "Email Address",
    emailPlaceholder: "alex@company.com",
    messageLabel: "How can we help?",
    messagePlaceholder: "Tell us briefly how we can assist you...",
    submitBtn: "Submit Request",
    submittingBtn: "Submitting...",
    errorName: "Please enter your name.",
    errorEmail: "Please enter a valid email address.",
    errorGeneral: "Could not send your request. Please try again shortly.",
    successTitle: "Thank you for reaching out!",
    successDesc: "We've received your request and our team will be in touch shortly.",
    sentDetailsTitle: "Submitted details:",
    sendAnother: "Submit another request",
    backToChat: "Back to chat",
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactTab({
  config,
  language,
  selectedAgent,
  sessionId,
  requestContext,
  palette,
  onSwitchToChat,
}: ContactTabProps) {
  const lang = language ?? resolveWidgetLanguage(config);
  const t = TRANSLATIONS[lang];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{
    name: string;
    email: string;
    phone: string;
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setErrorMessage(t.errorName);
      return;
    }

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage(t.errorEmail);
      return;
    }

    setIsSubmitting(true);

    const leadMessage = trimmedMessage
      ? `[Kontaktformulär] ${trimmedMessage}`
      : "[Kontaktformulär] Förfrågan om återkoppling";

    try {
      await submitWidgetLead(
        config.widgetPublicKey,
        {
          sessionId,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone || undefined,
          message: leadMessage,
          widgetAgentId: selectedAgent?.widgetAgentId,
        },
        requestContext,
      );

      setLastSubmission({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        message: trimmedMessage,
      });
      setIsSubmitted(true);
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setErrorMessage(null);
  };

  return (
    <motion.div
      key="contact-tab"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22 }}
      className="absolute inset-0 flex flex-col overflow-y-auto widget-scroll px-5 py-3"
    >
      <div className="flex w-full max-w-md flex-col mx-auto my-auto py-2">
        {isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center px-4 py-6"
          >
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-black/5"
              style={{
                backgroundColor: "var(--widget-accent-soft)",
                color: palette.primary,
              }}
            >
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-widget-fg sm:text-2xl">
              {t.successTitle}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-widget-muted max-w-xs">
              {t.successDesc}
            </p>

            {lastSubmission && (
              <div className="mt-5 w-full rounded-2xl border border-[var(--widget-border)] bg-[var(--widget-input-surface)] p-3.5 text-left text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-widget-muted mb-2">
                  {t.sentDetailsTitle}
                </div>
                <div className="space-y-1 text-widget-fg">
                  <div>
                    <span className="font-medium text-widget-muted">Namn: </span>
                    {lastSubmission.name}
                  </div>
                  <div>
                    <span className="font-medium text-widget-muted">E-post: </span>
                    {lastSubmission.email}
                  </div>
                  {lastSubmission.phone && (
                    <div>
                      <span className="font-medium text-widget-muted">Telefon: </span>
                      {lastSubmission.phone}
                    </div>
                  )}
                  {lastSubmission.message && (
                    <div className="pt-1 text-widget-muted italic border-t border-[var(--widget-border)] mt-2">
                      &ldquo;{lastSubmission.message}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex w-full flex-col gap-2.5">
              <button
                type="button"
                onClick={onSwitchToChat}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-transform active:scale-[0.98] shadow-sm"
                style={{
                  backgroundColor: palette.primary,
                  color: palette.primaryFg,
                }}
              >
                <MessageSquare className="h-4 w-4" />
                {t.backToChat}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl py-2 text-xs font-medium text-widget-muted transition-colors hover:text-widget-fg"
              >
                {t.sendAnother}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col w-full">
            {/* Header / Intro */}
            <div className="mb-4 text-center">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-widget-fg">
                {t.title}
              </h1>
              <p className="mt-1 text-[12.5px] text-widget-muted leading-relaxed max-w-xs mx-auto">
                {t.subtitle}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs font-medium text-red-500 animate-fadeIn">
                  {errorMessage}
                </div>
              )}

              {/* Name field */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-widget-fg/80 pl-1">
                  <User className="h-3.5 w-3.5 text-widget-muted" />
                  <span>{t.nameLabel}</span>
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="widget-input-shell w-full rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40 focus:outline-none"
                />
              </div>

              {/* Phone & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Phone */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-widget-fg/80 pl-1">
                    <Phone className="h-3.5 w-3.5 text-widget-muted" />
                    <span>{t.phoneLabel}</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="widget-input-shell w-full rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40 focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-widget-fg/80 pl-1">
                    <Mail className="h-3.5 w-3.5 text-widget-muted" />
                    <span>{t.emailLabel}</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="widget-input-shell w-full rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Message field */}
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-widget-fg/80 pl-1">
                  <MessageSquare className="h-3.5 w-3.5 text-widget-muted" />
                  <span>{t.messageLabel}</span>
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.messagePlaceholder}
                  className="widget-input-shell w-full rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-widget-fg shadow-inner placeholder:text-widget-fg/40 focus:outline-none resize-none"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 shadow-btn-glow"
                style={{
                  backgroundColor: palette.primary,
                  color: palette.primaryFg,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t.submittingBtn}</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>{t.submitBtn}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </motion.div>
  );
}
