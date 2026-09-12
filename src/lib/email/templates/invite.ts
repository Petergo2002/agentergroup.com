/** Workspace invitation email. */

import {
  button,
  chip,
  detailRows,
  divider,
  heading,
  note,
  paragraph,
  strong,
  urlFallback,
} from "../components.ts";
import { EMAIL_LANG_TAG, emailCopy, type EmailLocale } from "../copy.ts";
import { escapeHtml } from "../html.ts";
import { renderEmail } from "../layout.ts";
import type { RenderedEmail } from "./types.ts";

export const INVITE_EXPIRY_DAYS = 7;

export type InviteEmailOptions = {
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
  origin: string;
  locale: EmailLocale;
  postalAddress?: string;
};

/**
 * Builds the workspace invite email.
 *
 * @returns Subject, HTML body and plain-text alternative.
 */
export function buildInviteEmail(options: InviteEmailOptions): RenderedEmail {
  const t = emailCopy[options.locale];
  const workspace = options.workspaceName.trim() || "Avenro";
  const inviter = options.inviterName.trim() || "Avenro";
  const subject = t.invite.subject(workspace);

  const content = [
    chip(t.invite.chip),
    heading(t.invite.heading(workspace)),
    // The copy helpers are plain interpolation, so passing pre-escaped markup
    // for the emphasised names is safe and keeps the sentence translatable.
    paragraph(t.invite.intro(strong(inviter), strong(workspace))),
    paragraph(escapeHtml(t.invite.what)),
    detailRows([
      { label: t.invite.labelWorkspace, value: escapeHtml(workspace) },
      { label: t.invite.labelInvitedBy, value: escapeHtml(inviter) },
    ]),
    button({ label: t.invite.cta, url: options.acceptUrl }),
    urlFallback(t.shared.buttonFallback, options.acceptUrl),
    divider(26),
    note(escapeHtml(t.invite.expiryNote(INVITE_EXPIRY_DAYS))),
  ].join("\n");

  const html = renderEmail({
    subject,
    preheader: t.invite.preheader(inviter, workspace),
    origin: options.origin,
    lang: EMAIL_LANG_TAG[options.locale],
    content,
    footerReason: t.shared.footerReasonAccount,
    postalAddress: options.postalAddress,
  });

  const text = [
    subject,
    "",
    t.invite.intro(inviter, workspace),
    t.invite.what,
    "",
    `${t.invite.labelWorkspace}: ${workspace}`,
    `${t.invite.labelInvitedBy}: ${inviter}`,
    "",
    `${t.invite.cta}: ${options.acceptUrl}`,
    "",
    t.invite.expiryNote(INVITE_EXPIRY_DAYS),
    "",
    "Avenro · avenro.se",
  ].join("\n");

  return { subject, html, text };
}
