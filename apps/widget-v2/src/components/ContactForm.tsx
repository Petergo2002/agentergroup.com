import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import type { WidgetConfig, WidgetContactFormSettings } from "../types";

export interface ContactFormProps {
  config: WidgetConfig;
  contactFormSettings: WidgetContactFormSettings;
  quotaFallbackActive: boolean;
  contactName: string;
  setContactName: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;
  contactPhone: string;
  setContactPhone: (val: string) => void;
  contactMessage: string;
  setContactMessage: (val: string) => void;
  isSubmittingContact: boolean;
  contactSubmitSuccess: boolean;
  setContactSubmitSuccess: (val: boolean) => void;
  contactSubmitError: string | null;
  setContactSubmitError: (val: string | null) => void;
  submitContactForm: (e?: FormEvent) => Promise<void>;
}

export function ContactForm({
  config,
  contactFormSettings,
  quotaFallbackActive,
  contactName,
  setContactName,
  contactEmail,
  setContactEmail,
  contactPhone,
  setContactPhone,
  contactMessage,
  setContactMessage,
  isSubmittingContact,
  contactSubmitSuccess,
  setContactSubmitSuccess,
  contactSubmitError,
  setContactSubmitError,
  submitContactForm,
}: ContactFormProps) {
  const language = config.widget.language ?? "en";

  const t = {
    en: {
      quotaWarning: "Your free AI quota has been used. The contact form is still active.",
      sendAnother: "Send another form",
      nameLabel: "Name *",
      namePlaceholder: "Your name",
      emailLabel: "Email *",
      phoneLabel: "Phone",
      messageLabel: "Message",
      messagePlaceholder: "How can we help?",
      sending: "Sending...",
    },
    sv: {
      quotaWarning: "Din AI-kvot är slut. Kontaktformuläret är fortfarande aktivt.",
      sendAnother: "Skicka ett nytt formulär",
      nameLabel: "Namn *",
      namePlaceholder: "Ditt namn",
      emailLabel: "E-post *",
      phoneLabel: "Telefon",
      messageLabel: "Meddelande",
      messagePlaceholder: "Hur kan vi hjälpa?",
      sending: "Skickar...",
    },
  }[language as "en" | "sv"] || {
    // Fallback dictionary for en
    quotaWarning: "Your free AI quota has been used. The contact form is still active.",
    sendAnother: "Send another form",
    nameLabel: "Name *",
    namePlaceholder: "Your name",
    emailLabel: "Email *",
    phoneLabel: "Phone",
    messageLabel: "Message",
    messagePlaceholder: "How can we help?",
    sending: "Sending...",
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 widget-scroll pb-24 bg-transparent">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {quotaFallbackActive ? (
          <div className="rounded-2xl border border-white/10 bg-red-900/10 px-4 py-3 text-sm text-red-200">
            {t.quotaWarning}
          </div>
        ) : null}
        <div className="text-center mb-8">
          <p className="text-widget-muted text-lg font-medium leading-relaxed">
            {contactFormSettings.introText}
          </p>
        </div>

        {contactSubmitSuccess ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-xl backdrop-blur-sm">
            <p className="text-widget-fg text-xl font-bold leading-relaxed mb-6">
              {contactFormSettings.successMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                setContactSubmitSuccess(false);
                setContactSubmitError(null);
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-widget-primary px-8 py-3 text-sm font-bold text-widget-primary-fg shadow-btn-glow hover:opacity-90 transition-all active:scale-95"
            >
              {t.sendAnother}
            </button>
          </div>
        ) : (
          <form
            onSubmit={submitContactForm}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 shadow-xl backdrop-blur-sm space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-widget-fg space-y-2">
                <span className="block text-xs uppercase tracking-widest font-bold text-widget-muted">
                  {t.nameLabel}
                </span>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-base text-widget-fg placeholder:text-widget-muted/30 focus:outline-none focus:border-widget-primary/40 transition-colors"
                  placeholder={t.namePlaceholder}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="text-sm text-widget-fg space-y-2">
                <span className="block text-xs uppercase tracking-widest font-bold text-widget-muted">
                  {t.emailLabel}
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-base text-widget-fg placeholder:text-widget-muted/30 focus:outline-none focus:border-widget-primary/40 transition-colors"
                  placeholder="name@email.com"
                  autoComplete="email"
                  required
                />
              </label>
            </div>

            <label className="block text-sm text-widget-fg space-y-2">
                <span className="block text-xs uppercase tracking-widest font-bold text-widget-muted">
                {t.phoneLabel}
              </span>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-base text-widget-fg placeholder:text-widget-muted/30 focus:outline-none focus:border-widget-primary/40 transition-colors"
                placeholder="+46..."
                autoComplete="tel"
              />
            </label>

            <label className="block text-sm text-widget-fg space-y-2">
                <span className="block text-xs uppercase tracking-widest font-bold text-widget-muted">
                {t.messageLabel}
              </span>
              <textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                className="w-full min-h-[120px] rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-base text-widget-fg placeholder:text-widget-muted/30 focus:outline-none focus:border-widget-primary/40 transition-colors resize-none"
                placeholder={t.messagePlaceholder}
              />
            </label>

            {contactSubmitError && (
              <p className="text-sm text-red-400">{contactSubmitError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmittingContact}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-widget-primary px-6 py-4 text-lg font-bold text-widget-primary-fg shadow-btn-glow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isSubmittingContact ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.sending}
                </>
              ) : (
                contactFormSettings.submitButtonText
              )}
            </button>
          </form>
        )}

        {(config.widget.showBranding ?? true) && (
          <div className="mt-8 text-center">
            <p className="text-[11px] text-widget-muted font-bold tracking-widest uppercase opacity-40">
              Powered by Agenter Group
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
