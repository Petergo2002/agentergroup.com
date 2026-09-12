/**
 * Email copy in the two platform languages.
 *
 * Kept separate from `src/locales` on purpose: emails are rendered on the
 * server (and mirrored into static Supabase Auth templates), so they must not
 * depend on the app's client-side message bundles.
 */

export const EMAIL_LOCALES = ["en", "sv"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];
export const DEFAULT_EMAIL_LOCALE: EmailLocale = "en";

/** Narrows an arbitrary value to a supported email locale. */
export function resolveEmailLocale(value: unknown): EmailLocale {
  return EMAIL_LOCALES.includes(value as EmailLocale)
    ? (value as EmailLocale)
    : DEFAULT_EMAIL_LOCALE;
}

/** BCP 47 tag for the `lang` attribute. */
export const EMAIL_LANG_TAG: Record<EmailLocale, string> = {
  en: "en",
  sv: "sv",
};

type Copy = {
  shared: {
    buttonFallback: string;
    footerReasonTransactional: string;
    footerReasonAccount: string;
    footerReasonNotification: string;
    ignore: string;
    help: string;
  };
  invite: {
    subject: (workspace: string) => string;
    preheader: (inviter: string, workspace: string) => string;
    chip: string;
    heading: (workspace: string) => string;
    intro: (inviter: string, workspace: string) => string;
    what: string;
    cta: string;
    labelWorkspace: string;
    labelInvitedBy: string;
    labelExpires: (days: number) => string;
    expiryNote: (days: number) => string;
  };
  lead: {
    subject: (name: string, widget: string) => string;
    preheader: (name: string) => string;
    chip: (widget: string) => string;
    heading: (name: string) => string;
    intro: (widget: string) => string;
    labelName: string;
    labelEmail: string;
    labelPhone: string;
    labelReceived: string;
    messageLabel: string;
    cta: string;
    replyHint: (email: string) => string;
    noMessage: string;
  };
  auth: {
    confirmSubject: string;
    confirmPreheader: string;
    confirmChip: string;
    confirmHeading: string;
    confirmIntro: string;
    confirmCta: string;
    magicSubject: string;
    magicPreheader: string;
    magicChip: string;
    magicHeading: string;
    magicIntro: string;
    magicCta: string;
    resetSubject: string;
    resetPreheader: string;
    resetChip: string;
    resetHeading: string;
    resetIntro: string;
    resetCta: string;
    resetNote: string;
    changeSubject: string;
    changePreheader: string;
    changeChip: string;
    changeHeading: string;
    changeIntro: string;
    changeCta: string;
    codeLabel: string;
    linkExpiry: string;
    notYou: string;
  };
};

const en: Copy = {
  shared: {
    buttonFallback: "Button not working? Paste this link into your browser:",
    footerReasonTransactional:
      "You received this email because it relates to an action taken on your Avenro account.",
    footerReasonAccount:
      "You received this email because someone requested it for this address on Avenro.",
    footerReasonNotification:
      "You received this email because you own an Avenro workspace with lead notifications enabled.",
    ignore: "If you weren't expecting this, you can safely ignore this email.",
    help: "Questions? Just reply to this email.",
  },
  invite: {
    subject: (workspace) => `You're invited to ${workspace} on Avenro`,
    preheader: (inviter, workspace) => `${inviter} added you to the ${workspace} workspace.`,
    chip: "Workspace invitation",
    heading: (workspace) => `Join ${workspace} on Avenro`,
    intro: (inviter, workspace) =>
      `${inviter} has invited you to collaborate in the ${workspace} workspace.`,
    what:
      "Accept the invitation to build AI agents, manage the chat widget and follow up on leads with the rest of the team.",
    cta: "Accept invitation",
    labelWorkspace: "Workspace",
    labelInvitedBy: "Invited by",
    labelExpires: (days) => `${days} days`,
    expiryNote: (days) =>
      `This invitation expires in ${days} days. If you weren't expecting it, you can safely ignore this email.`,
  },
  lead: {
    subject: (name, widget) => `New enquiry from ${name} · ${widget}`,
    preheader: (name) => `${name} left their contact details on your website.`,
    chip: (widget) => `${widget} · New enquiry`,
    heading: (name) => `${name} wants to hear from you`,
    intro: (widget) =>
      `A visitor left their contact details in a conversation with ${widget} on your website.`,
    labelName: "Name",
    labelEmail: "Email",
    labelPhone: "Phone",
    labelReceived: "Received",
    messageLabel: "Message",
    cta: "Open in dashboard",
    replyHint: (email) => `Reply directly to ${email} or open the lead in the dashboard.`,
    noMessage: "The visitor didn't leave a message.",
  },
  auth: {
    confirmSubject: "Confirm your email address",
    confirmPreheader: "One click and your Avenro account is ready.",
    confirmChip: "Confirm your account",
    confirmHeading: "Confirm your email address",
    confirmIntro:
      "Welcome to Avenro. Confirm this address to activate your account and start building your first AI agent.",
    confirmCta: "Confirm email address",
    magicSubject: "Your Avenro sign-in link",
    magicPreheader: "A single-use link to sign in to your Avenro account.",
    magicChip: "Sign in",
    magicHeading: "Sign in to Avenro",
    magicIntro: "Use the button below to sign in. The link works once and only on this device.",
    magicCta: "Sign in to Avenro",
    resetSubject: "Reset your Avenro password",
    resetPreheader: "Choose a new password for your Avenro account.",
    resetChip: "Password reset",
    resetHeading: "Reset your password",
    resetIntro:
      "We received a request to reset the password for your Avenro account. Choose a new one with the button below.",
    resetCta: "Choose a new password",
    resetNote:
      "If you didn't request a password reset, you can ignore this email — your password stays unchanged.",
    changeSubject: "Confirm your new email address",
    changePreheader: "Confirm the address change on your Avenro account.",
    changeChip: "Email change",
    changeHeading: "Confirm your new email address",
    changeIntro:
      "Confirm this address to finish changing the email connected to your Avenro account.",
    changeCta: "Confirm the change",
    codeLabel: "Or enter this code:",
    linkExpiry: "This link expires in 60 minutes and can only be used once.",
    notYou: "Wasn't you? Ignore this email and contact us at info@avenro.se.",
  },
};

const sv: Copy = {
  shared: {
    buttonFallback: "Fungerar inte knappen? Klistra in länken i webbläsaren:",
    footerReasonTransactional:
      "Du får det här mejlet för att det rör en åtgärd på ditt Avenro-konto.",
    footerReasonAccount:
      "Du får det här mejlet för att någon begärde det för den här adressen på Avenro.",
    footerReasonNotification:
      "Du får det här mejlet för att du äger en Avenro-arbetsyta med aviseringar om nya förfrågningar.",
    ignore: "Om du inte väntade dig det här kan du ignorera mejlet.",
    help: "Frågor? Svara direkt på det här mejlet.",
  },
  invite: {
    subject: (workspace) => `Du är inbjuden till ${workspace} på Avenro`,
    preheader: (inviter, workspace) => `${inviter} lade till dig i arbetsytan ${workspace}.`,
    chip: "Inbjudan till arbetsyta",
    heading: (workspace) => `Gå med i ${workspace} på Avenro`,
    intro: (inviter, workspace) =>
      `${inviter} har bjudit in dig att samarbeta i arbetsytan ${workspace}.`,
    what:
      "Tacka ja för att bygga AI-agenter, hantera chattwidgeten och följa upp förfrågningar tillsammans med resten av teamet.",
    cta: "Tacka ja till inbjudan",
    labelWorkspace: "Arbetsyta",
    labelInvitedBy: "Inbjuden av",
    labelExpires: (days) => `${days} dagar`,
    expiryNote: (days) =>
      `Inbjudan gäller i ${days} dagar. Om du inte väntade dig den kan du ignorera mejlet.`,
  },
  lead: {
    subject: (name, widget) => `Ny förfrågan från ${name} · ${widget}`,
    preheader: (name) => `${name} lämnade sina kontaktuppgifter på er webbplats.`,
    chip: (widget) => `${widget} · Ny förfrågan`,
    heading: (name) => `${name} vill bli kontaktad`,
    intro: (widget) =>
      `En besökare lämnade sina kontaktuppgifter i ett samtal med ${widget} på er webbplats.`,
    labelName: "Namn",
    labelEmail: "E-post",
    labelPhone: "Telefon",
    labelReceived: "Mottagen",
    messageLabel: "Meddelande",
    cta: "Öppna i dashboarden",
    replyHint: (email) => `Svara direkt till ${email} eller öppna förfrågan i dashboarden.`,
    noMessage: "Besökaren lämnade inget meddelande.",
  },
  auth: {
    confirmSubject: "Bekräfta din e-postadress",
    confirmPreheader: "Ett klick så är ditt Avenro-konto klart.",
    confirmChip: "Bekräfta ditt konto",
    confirmHeading: "Bekräfta din e-postadress",
    confirmIntro:
      "Välkommen till Avenro. Bekräfta adressen för att aktivera kontot och bygga din första AI-agent.",
    confirmCta: "Bekräfta e-postadressen",
    magicSubject: "Din inloggningslänk till Avenro",
    magicPreheader: "En engångslänk för att logga in på ditt Avenro-konto.",
    magicChip: "Logga in",
    magicHeading: "Logga in på Avenro",
    magicIntro:
      "Använd knappen nedan för att logga in. Länken fungerar en gång och bara på den här enheten.",
    magicCta: "Logga in på Avenro",
    resetSubject: "Återställ ditt lösenord på Avenro",
    resetPreheader: "Välj ett nytt lösenord för ditt Avenro-konto.",
    resetChip: "Återställ lösenord",
    resetHeading: "Återställ ditt lösenord",
    resetIntro:
      "Vi fick en begäran om att återställa lösenordet för ditt Avenro-konto. Välj ett nytt med knappen nedan.",
    resetCta: "Välj ett nytt lösenord",
    resetNote:
      "Om du inte begärde en återställning kan du ignorera mejlet — ditt lösenord ändras inte.",
    changeSubject: "Bekräfta din nya e-postadress",
    changePreheader: "Bekräfta adressbytet på ditt Avenro-konto.",
    changeChip: "Byte av e-post",
    changeHeading: "Bekräfta din nya e-postadress",
    changeIntro:
      "Bekräfta adressen för att slutföra bytet av e-post kopplad till ditt Avenro-konto.",
    changeCta: "Bekräfta bytet",
    codeLabel: "Eller ange den här koden:",
    linkExpiry: "Länken gäller i 60 minuter och kan bara användas en gång.",
    notYou: "Var det inte du? Ignorera mejlet och kontakta oss på info@avenro.se.",
  },
};

export const emailCopy: Record<EmailLocale, Copy> = { en, sv };
