/** New-lead notification sent to the workspace owner. */

import {
  button,
  chip,
  detailRows,
  divider,
  heading,
  link,
  note,
  paragraph,
  quote,
  urlFallback,
} from "../components.ts";
import { EMAIL_LANG_TAG, emailCopy, type EmailLocale } from "../copy.ts";
import { escapeHtml, nl2br } from "../html.ts";
import { renderEmail } from "../layout.ts";
import type { RenderedEmail } from "./types.ts";

export type LeadEmailOptions = {
  widgetName: string;
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    message?: string | null;
  };
  leadsUrl: string;
  origin: string;
  locale: EmailLocale;
  receivedAt?: Date;
  postalAddress?: string;
};

/** Formats the received timestamp in the reader's language, Stockholm time. */
function formatReceivedAt(date: Date, locale: EmailLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Stockholm",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Strips the internal `[Kontaktformulär]` tag and the placeholder text the
 * widget stores when a visitor only asked to be called back.
 *
 * @returns The message worth showing, or `null`.
 */
function readableMessage(message: string | null | undefined): string | null {
  const stripped = (message ?? "")
    .trim()
    .replace(/^\[(Kontaktformulär|Contact Form)\]\s*/i, "")
    .trim();

  if (!stripped) return null;

  const placeholder = stripped.toLowerCase();
  if (placeholder === "förfrågan om återkoppling" || placeholder === "request a callback") {
    return null;
  }

  return stripped;
}

/**
 * Builds the new-lead notification email.
 *
 * @returns Subject, HTML body and plain-text alternative.
 */
export function buildLeadNotificationEmail(options: LeadEmailOptions): RenderedEmail {
  const t = emailCopy[options.locale];
  const widgetName = options.widgetName.trim() || "Milo";
  const fallbackName = options.locale === "sv" ? "Ny besökare" : "New visitor";
  const name = options.lead.name?.trim() || fallbackName;
  const email = options.lead.email?.trim() ?? "";
  const phone = options.lead.phone?.trim() || null;
  const message = readableMessage(options.lead.message);
  const receivedAt = options.receivedAt ?? new Date();
  const subject = t.lead.subject(name, widgetName);

  const rows: Array<{ label: string; value: string }> = [
    { label: t.lead.labelName, value: escapeHtml(name) },
  ];
  if (email) {
    rows.push({ label: t.lead.labelEmail, value: link(`mailto:${email}`, email) });
  }
  if (phone) {
    rows.push({ label: t.lead.labelPhone, value: link(`tel:${phone.replace(/\s+/g, "")}`, phone) });
  }
  rows.push({
    label: t.lead.labelReceived,
    value: escapeHtml(formatReceivedAt(receivedAt, options.locale)),
  });

  const content = [
    chip(t.lead.chip(widgetName)),
    heading(t.lead.heading(name)),
    paragraph(escapeHtml(t.lead.intro(widgetName))),
    detailRows(rows),
    message
      ? quote(t.lead.messageLabel, nl2br(escapeHtml(message)))
      : paragraph(escapeHtml(t.lead.noMessage), { muted: true, small: true }),
    button({ label: t.lead.cta, url: options.leadsUrl }),
    urlFallback(t.shared.buttonFallback, options.leadsUrl),
    divider(26),
    note(escapeHtml(email ? t.lead.replyHint(email) : t.shared.help)),
  ].join("\n");

  const html = renderEmail({
    subject,
    preheader: t.lead.preheader(name),
    origin: options.origin,
    lang: EMAIL_LANG_TAG[options.locale],
    content,
    footerReason: t.shared.footerReasonNotification,
    postalAddress: options.postalAddress,
  });

  const text = [
    subject,
    "",
    t.lead.intro(widgetName),
    "",
    `${t.lead.labelName}: ${name}`,
    email ? `${t.lead.labelEmail}: ${email}` : null,
    phone ? `${t.lead.labelPhone}: ${phone}` : null,
    `${t.lead.labelReceived}: ${formatReceivedAt(receivedAt, options.locale)}`,
    "",
    message ? `${t.lead.messageLabel}:\n${message}` : t.lead.noMessage,
    "",
    `${t.lead.cta}: ${options.leadsUrl}`,
    "",
    "Avenro · avenro.se",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, html, text };
}
