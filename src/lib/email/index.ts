import { Resend } from "resend";
import { getAppUrl } from "@/lib/env";
import { resolveEmailLocale, type EmailLocale } from "./copy.ts";
import { emailBrand, resolveEmailAssetOrigin } from "./theme.ts";
import { buildInviteEmail } from "./templates/invite.ts";
import { buildLeadNotificationEmail } from "./templates/lead-notification.ts";

export type { EmailLocale } from "./copy.ts";
export { resolveEmailLocale } from "./copy.ts";

type SendResult = { success: boolean; error?: string; id?: string };

/** Returns true if the Resend API key is configured. */
export function hasEmailEnv(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Returns the configured "from" address for transactional emails. */
function getFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS ?? `${emailBrand.name} <noreply@avenro.se>`;
}

/**
 * Address replies go to.
 *
 * `noreply@` senders get filtered aggressively, so every email offers a real
 * inbox to answer into unless the caller overrides it.
 */
function getReplyToAddress(): string {
  return process.env.EMAIL_REPLY_TO_ADDRESS ?? emailBrand.supportEmail;
}

/** Optional postal address rendered in the footer. */
function getPostalAddress(): string | undefined {
  return process.env.EMAIL_POSTAL_ADDRESS?.trim() || undefined;
}

/** Creates a Resend client instance. */
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing. Add it to .env.local.");
  }
  return new Resend(apiKey);
}

/** Normalises Resend's error shape into a message string. */
function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return error instanceof Error ? error.message : "Unknown email error.";
}

/** Sends one rendered email through Resend and normalises the result. */
async function deliver(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tag: string;
  context: string;
}): Promise<SendResult> {
  if (!hasEmailEnv()) {
    console.warn(`[email] RESEND_API_KEY not configured — skipping ${options.context}.`);
    return { success: false, error: "Email service not configured." };
  }

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: options.to,
      replyTo: options.replyTo ?? getReplyToAddress(),
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: {
        // Lets mail clients thread and lets providers suppress duplicates.
        "X-Entity-Ref-ID": `${options.tag}-${Date.now()}`,
      },
    });

    if (error) {
      const message = readErrorMessage(error);
      console.error(`[email] Failed to send ${options.context}:`, message);
      return { success: false, error: message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    const message = readErrorMessage(error);
    console.error(`[email] Failed to send ${options.context}:`, message);
    return { success: false, error: message };
  }
}

/** Sends a workspace invite email to the given address. */
export async function sendInviteEmail(options: {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviteToken: string;
  locale?: EmailLocale | string;
}): Promise<SendResult> {
  const appUrl = getAppUrl();
  const origin = resolveEmailAssetOrigin(appUrl);
  const { subject, html, text } = buildInviteEmail({
    workspaceName: options.workspaceName,
    inviterName: options.inviterName,
    acceptUrl: `${appUrl}/invite/accept?token=${encodeURIComponent(options.inviteToken)}`,
    origin,
    locale: resolveEmailLocale(options.locale),
    postalAddress: getPostalAddress(),
  });

  return deliver({
    to: options.to,
    subject,
    html,
    text,
    tag: "invite",
    context: "invite email",
  });
}

/**
 * Notifies the workspace owner that a visitor left their contact details.
 *
 * Replies go straight to the lead so the owner can answer from the inbox.
 */
export async function sendLeadNotificationEmail(options: {
  to: string;
  widgetName: string;
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    message?: string | null;
  };
  locale?: EmailLocale | string;
}): Promise<SendResult> {
  const appUrl = getAppUrl();
  const origin = resolveEmailAssetOrigin(appUrl);

  // Anything generic or left over from the old Maja naming shows up as Milo.
  const rawWidgetName = options.widgetName?.trim() || "";
  const widgetName =
    !rawWidgetName || /^(maja|widget|avenro\s*widget)$/i.test(rawWidgetName)
      ? "Milo"
      : rawWidgetName;

  const { subject, html, text } = buildLeadNotificationEmail({
    widgetName,
    lead: options.lead,
    leadsUrl: `${appUrl}/leads`,
    origin,
    // Lead notifications go to Swedish-speaking operators by default.
    locale: resolveEmailLocale(options.locale ?? "sv"),
    postalAddress: getPostalAddress(),
  });

  const leadEmail = options.lead.email?.trim();

  return deliver({
    to: options.to,
    subject,
    html,
    text,
    replyTo: leadEmail || undefined,
    tag: "lead",
    context: "lead notification email",
  });
}
