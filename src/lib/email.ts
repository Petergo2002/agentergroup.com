import { Resend } from "resend";
import { getAppUrl } from "@/lib/env";

/** Returns true if the Resend API key is configured. */
export function hasEmailEnv(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Returns the configured "from" address for transactional emails. */
function getFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS ?? "Avenro <noreply@avenro.se>";
}

/** Creates a Resend client instance. */
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing. Add it to .env.local.");
  }
  return new Resend(apiKey);
}

/** Sends a workspace invite email to the given address. */
export async function sendInviteEmail(options: {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviteToken: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!hasEmailEnv()) {
    console.warn("[email] RESEND_API_KEY not configured — skipping invite email.");
    return { success: false, error: "Email service not configured." };
  }

  const appUrl = getAppUrl();
  const acceptUrl = `${appUrl}/invite/accept?token=${options.inviteToken}`;

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: options.to,
      subject: `You've been invited to ${options.workspaceName} on Avenro`,
      html: buildInviteHtml({
        workspaceName: options.workspaceName,
        inviterName: options.inviterName,
        acceptUrl,
      }),
    });

    if (error) {
      const message = "message" in error && typeof error.message === "string"
        ? error.message
        : "Unknown email error.";
      console.error("[email] Failed to send invite email:", message);
      return { success: false, error: message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Failed to send invite email:", message);
    return { success: false, error: message };
  }
}

/** Sends a notification email to the workspace/widget owner when a new lead/contact form is submitted. */
export async function sendLeadNotificationEmail(options: {
  to: string;
  widgetName: string;
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    message?: string | null;
  };
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!hasEmailEnv()) {
    console.warn("[email] RESEND_API_KEY not configured — skipping lead notification email.");
    return { success: false, error: "Email service not configured." };
  }

  const appUrl = getAppUrl();
  const leadsUrl = `${appUrl}/leads`;

  // Normalize widget name: always Milo if Maja, generic or empty
  const rawWidgetName = options.widgetName?.trim() || "";
  const widgetName =
    !rawWidgetName || /^(maja|widget|avenro\s*widget)$/i.test(rawWidgetName)
      ? "Milo"
      : rawWidgetName;

  const leadName = options.lead.name?.trim() || "Ny besökare";

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: options.to,
      subject: `Ny förfrågan från ${leadName} · ${widgetName}`,
      html: buildLeadNotificationHtml({
        widgetName,
        lead: options.lead,
        leadsUrl,
      }),
    });

    if (error) {
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Unknown email error.";
      console.error("[email] Failed to send lead notification email:", message);
      return { success: false, error: message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Failed to send lead notification email:", message);
    return { success: false, error: message };
  }
}

/** Builds a simple, clean HTML email body for the invite. */
function buildInviteHtml(options: {
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden;">
          <tr>
            <td style="padding: 40px 32px 32px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                You're invited!
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #64748b;">
                <strong style="color: #0f172a;">${escapeHtml(options.inviterName)}</strong> has invited you to join
                <strong style="color: #0f172a;">${escapeHtml(options.workspaceName)}</strong> on Avenro.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 12px; background-color: #0f172a;">
                    <a href="${options.acceptUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; letter-spacing: 0.02em;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
                This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center;">
                Avenro · AI Agent Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** Builds a clean, high-aesthetic HTML email for lead notifications matching Avenro brand standards. */
function buildLeadNotificationHtml(options: {
  widgetName: string;
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    message?: string | null;
  };
  leadsUrl: string;
}): string {
  const rawWidgetName = options.widgetName?.trim() || "";
  const widgetName =
    !rawWidgetName || /^(maja|widget|avenro\s*widget)$/i.test(rawWidgetName)
      ? "Milo"
      : escapeHtml(rawWidgetName);

  const name = escapeHtml(options.lead.name?.trim() || "Ej angivet");
  const email = escapeHtml(options.lead.email?.trim() || "");
  const phone = options.lead.phone?.trim() ? escapeHtml(options.lead.phone.trim()) : null;

  // Strip technical [Kontaktformulär] tag from the user-facing message text
  const rawMessage = options.lead.message?.trim() || "";
  const strippedMessage = rawMessage
    .replace(/^\[(Kontaktformulär|Contact Form)\]\s*/i, "")
    .trim();

  const isDefaultFallback =
    !strippedMessage ||
    strippedMessage.toLowerCase() === "förfrågan om återkoppling" ||
    strippedMessage.toLowerCase() === "request a callback";

  const displayMessage = isDefaultFallback
    ? null
    : escapeHtml(strippedMessage).replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Ny förfrågan från ${name} · ${widgetName}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      body, .email-bg { background-color: #0c0c0e !important; }
      .email-card { background-color: #141417 !important; border-color: #27272a !important; }
      .email-heading { color: #fafafa !important; }
      .email-subtext { color: #a1a1aa !important; }
      .email-label { color: #71717a !important; }
      .email-value { color: #fafafa !important; }
      .email-divider { border-color: #27272a !important; }
      .email-kicker { background-color: #2a150c !important; border-color: #4a2211 !important; color: #ff8533 !important; }
      .email-quote { background-color: #1a1a1e !important; color: #e4e4e7 !important; border-color: #ff5c00 !important; }
      .email-footer { background-color: #0f0f12 !important; border-color: #27272a !important; color: #71717a !important; }
      .email-link { color: #ff8533 !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" class="email-card" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e4e4e7; border-top: 4px solid #ff5c00; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05); overflow: hidden; border-collapse: separate;">
          <tr>
            <td style="padding: 34px 32px 28px;">
              <!-- Kicker / Badge -->
              <div class="email-kicker" style="display: inline-block; padding: 4px 10px; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #ea580c; margin-bottom: 14px;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #ff5c00; margin-right: 5px; vertical-align: middle;"></span>${widgetName} · Ny förfrågan
              </div>

              <!-- Title -->
              <h1 class="email-heading" style="margin: 0 0 6px; font-size: 20px; font-weight: 700; color: #09090b; letter-spacing: -0.02em; line-height: 1.3;">
                ${name} har skickat en förfrågan
              </h1>
              <p class="email-subtext" style="margin: 0 0 24px; font-size: 13.5px; color: #71717a; line-height: 1.5;">
                En besökare har lämnat sina kontaktuppgifter via ${widgetName} på er webbplats.
              </p>

              <!-- Details Table (Clean rows, no clunky nested gray boxes) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td class="email-label email-divider" style="padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #71717a; font-weight: 500; width: 85px;">
                    Namn
                  </td>
                  <td class="email-value email-divider" style="padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #09090b; font-weight: 600;">
                    ${name}
                  </td>
                </tr>
                <tr>
                  <td class="email-label email-divider" style="padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #71717a; font-weight: 500;">
                    E-post
                  </td>
                  <td class="email-divider" style="padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600;">
                    <a href="mailto:${email}" class="email-link" style="color: #ff5c00; text-decoration: none;">${email}</a>
                  </td>
                </tr>
                ${phone ? `
                <tr>
                  <td class="email-label email-divider" style="padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #71717a; font-weight: 500;">
                    Telefon
                  </td>
                  <td class="email-value email-divider" style="padding: 11px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #09090b; font-weight: 600;">
                    <a href="tel:${phone}" class="email-value" style="color: #09090b; text-decoration: none;">${phone}</a>
                  </td>
                </tr>` : ""}
                ${displayMessage ? `
                <tr>
                  <td colspan="2" style="padding-top: 16px;">
                    <div class="email-label" style="font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; margin-bottom: 8px;">
                      Meddelande
                    </div>
                    <div class="email-quote" style="font-size: 13.5px; line-height: 1.6; color: #18181b; background-color: #fafafa; border-radius: 8px; border-left: 3px solid #ff5c00; padding: 12px 16px;">
                      ${displayMessage}
                    </div>
                  </td>
                </tr>` : ""}
              </table>

              <!-- Action CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 4px; margin-bottom: 8px;">
                <tr>
                  <td style="border-radius: 8px; background-color: #ff5c00;">
                    <a href="${options.leadsUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 13.5px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.01em;">
                      Öppna i Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer footer-border" style="padding: 16px 32px; background-color: #fafafa; border-top: 1px solid #f1f5f9; text-align: center;">
              <p class="email-subtext" style="margin: 0; font-size: 12px; color: #a1a1aa; line-height: 1.4;">
                Avenro · Levererat av ${widgetName} på er webbplats
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** Escapes HTML special characters to prevent XSS in email templates. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

