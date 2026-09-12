/**
 * Supabase Auth email templates.
 *
 * Supabase renders these as Go templates on its own servers, so the output is
 * static HTML containing placeholders such as `{{ .ConfirmationURL }}`. They go
 * through the same layout as the app's own emails so signup, magic link and
 * password reset look like the rest of the product.
 *
 * Regenerate with `npm run email:templates` after changing the design.
 */

import {
  button,
  chip,
  codeBlock,
  divider,
  heading,
  note,
  paragraph,
  urlFallback,
} from "../components.ts";
import { EMAIL_LANG_TAG, emailCopy, type EmailLocale } from "../copy.ts";
import { escapeHtml } from "../html.ts";
import { renderEmail } from "../layout.ts";

/** Supabase's template slugs, used as the generated file names. */
export const AUTH_TEMPLATE_IDS = [
  "confirmation",
  "magic-link",
  "recovery",
  "email-change",
  "reauthentication",
] as const;

export type AuthTemplateId = (typeof AUTH_TEMPLATE_IDS)[number];

export type AuthTemplate = {
  id: AuthTemplateId;
  /** Label used in the Supabase dashboard. */
  dashboardName: string;
  subject: string;
  html: string;
};

const CONFIRMATION_URL = "{{ .ConfirmationURL }}";
const TOKEN = "{{ .Token }}";

/**
 * Builds every Supabase Auth template for one language.
 *
 * @param locale - Language for the copy.
 * @param origin - Absolute origin for the logo and footer links.
 * @returns One entry per Supabase template.
 */
export function buildAuthTemplates(locale: EmailLocale, origin: string): AuthTemplate[] {
  const t = emailCopy[locale];
  const lang = EMAIL_LANG_TAG[locale];

  const shell = (options: {
    subject: string;
    preheader: string;
    content: string;
  }) =>
    renderEmail({
      subject: options.subject,
      preheader: options.preheader,
      origin,
      lang,
      content: options.content,
      footerReason: t.shared.footerReasonAccount,
    });

  const linkBody = (options: {
    chipLabel: string;
    title: string;
    intro: string;
    cta: string;
    tone?: "dark" | "brand";
    closing: string;
  }) =>
    [
      chip(options.chipLabel),
      heading(options.title),
      paragraph(escapeHtml(options.intro)),
      button({ label: options.cta, url: CONFIRMATION_URL, tone: options.tone }),
      urlFallback(t.shared.buttonFallback, CONFIRMATION_URL),
      divider(26),
      note(`${escapeHtml(t.auth.linkExpiry)}<br />${escapeHtml(options.closing)}`),
    ].join("\n");

  return [
    {
      id: "confirmation",
      dashboardName: "Confirm signup",
      subject: t.auth.confirmSubject,
      html: shell({
        subject: t.auth.confirmSubject,
        preheader: t.auth.confirmPreheader,
        content: linkBody({
          chipLabel: t.auth.confirmChip,
          title: t.auth.confirmHeading,
          intro: t.auth.confirmIntro,
          cta: t.auth.confirmCta,
          closing: t.auth.notYou,
        }),
      }),
    },
    {
      id: "magic-link",
      dashboardName: "Magic Link",
      subject: t.auth.magicSubject,
      html: shell({
        subject: t.auth.magicSubject,
        preheader: t.auth.magicPreheader,
        content: linkBody({
          chipLabel: t.auth.magicChip,
          title: t.auth.magicHeading,
          intro: t.auth.magicIntro,
          cta: t.auth.magicCta,
          closing: t.auth.notYou,
        }),
      }),
    },
    {
      id: "recovery",
      dashboardName: "Reset Password",
      subject: t.auth.resetSubject,
      html: shell({
        subject: t.auth.resetSubject,
        preheader: t.auth.resetPreheader,
        content: linkBody({
          chipLabel: t.auth.resetChip,
          title: t.auth.resetHeading,
          intro: t.auth.resetIntro,
          cta: t.auth.resetCta,
          closing: t.auth.resetNote,
        }),
      }),
    },
    {
      id: "email-change",
      dashboardName: "Change Email Address",
      subject: t.auth.changeSubject,
      html: shell({
        subject: t.auth.changeSubject,
        preheader: t.auth.changePreheader,
        content: linkBody({
          chipLabel: t.auth.changeChip,
          title: t.auth.changeHeading,
          intro: t.auth.changeIntro,
          cta: t.auth.changeCta,
          closing: t.auth.notYou,
        }),
      }),
    },
    {
      id: "reauthentication",
      dashboardName: "Reauthentication",
      subject: locale === "sv" ? "Din verifieringskod" : "Your verification code",
      html: shell({
        subject: locale === "sv" ? "Din verifieringskod" : "Your verification code",
        preheader:
          locale === "sv"
            ? "Engångskod för att bekräfta din identitet."
            : "One-time code to confirm it's you.",
        content: [
          chip(locale === "sv" ? "Verifiering" : "Verification"),
          heading(locale === "sv" ? "Bekräfta att det är du" : "Confirm it's you"),
          paragraph(
            escapeHtml(
              locale === "sv"
                ? "Ange koden nedan i Avenro för att slutföra åtgärden."
                : "Enter the code below in Avenro to finish this action.",
            ),
          ),
          codeBlock(TOKEN),
          divider(26),
          note(
            `${escapeHtml(
              locale === "sv"
                ? "Koden gäller i 60 minuter och kan bara användas en gång."
                : "The code expires in 60 minutes and can only be used once.",
            )}<br />${escapeHtml(t.auth.notYou)}`,
          ),
        ].join("\n"),
      }),
    },
  ];
}
