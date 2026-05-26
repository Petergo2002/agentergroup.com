import { Resend } from "resend";
import { getAppUrl } from "@/lib/env";

/** Returns true if the Resend API key is configured. */
export function hasEmailEnv(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Returns the configured "from" address for transactional emails. */
function getFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS ?? "Agentergroup <noreply@agentergroup.com>";
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
      subject: `You've been invited to ${options.workspaceName} on Agentergroup`,
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
                <strong style="color: #0f172a;">${escapeHtml(options.workspaceName)}</strong> on Agentergroup.
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
                Agentergroup · AI Agent Platform
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
