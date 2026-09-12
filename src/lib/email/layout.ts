/**
 * The shared Avenro email shell: preheader, logo header, content card, footer.
 *
 * Every transactional email renders through `renderEmail` so the brand looks
 * identical whether it comes from this app or from Supabase Auth.
 */

import { emailBrand, emailTheme } from "./theme.ts";
import { escapeHtml, h, raw, safeUrl } from "./html.ts";

const { color, font, radius, width } = emailTheme;
const dark = color.dark;

export type EmailFooterLink = { label: string; url: string };

export type EmailLayoutOptions = {
  /** Browser/tab title and accessible document title. */
  subject: string;
  /** Inbox preview line. Keep it under ~90 characters and never repeat the subject verbatim. */
  preheader: string;
  /** Absolute origin used for the logo and footer links. */
  origin: string;
  /** `lang` attribute — drives screen-reader pronunciation and Gmail translation prompts. */
  lang: string;
  /** Pre-rendered component markup for the card body. */
  content: string;
  /** One line explaining why this person received the email. */
  footerReason: string;
  footerLinks?: EmailFooterLink[];
  /** Postal address line. Required by CAN-SPAM for anything promotional. */
  postalAddress?: string;
};

/**
 * Gmail and Outlook show the first text in the body as preview copy. The
 * zero-width padding pushes the real body copy out of that preview so the
 * snippet stays intentional instead of leaking the first sentence.
 */
function preheaderBlock(text: string): string {
  const padding = "&#847;&zwnj;&nbsp;".repeat(60);
  return h`<div class="preheader" style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${color.canvas};">${text}${raw(padding)}</div>`;
}

function headerBlock(origin: string): string {
  const lightLogo = `${origin}${emailBrand.logo.lightPath}`;
  const darkLogo = `${origin}${emailBrand.logo.darkPath}`;
  const alt = `${emailBrand.name} logotype`;

  return `
<tr>
  <td align="left" style="padding: 0 0 22px;">
    <a href="${safeUrl(origin)}" target="_blank" rel="noopener" style="text-decoration: none; border: 0;">
      <img src="${escapeHtml(lightLogo)}" width="${emailBrand.logo.width}" height="${emailBrand.logo.height}" alt="${escapeHtml(alt)}" class="logo-light" style="display: block; width: ${emailBrand.logo.width}px; height: auto; max-width: ${emailBrand.logo.width}px; border: 0; outline: none; text-decoration: none;" />
      <!--[if !mso]><!-- -->
      <img src="${escapeHtml(darkLogo)}" width="${emailBrand.logo.width}" height="${emailBrand.logo.height}" alt="${escapeHtml(alt)}" class="logo-dark" style="display: none; width: 0; max-height: 0; overflow: hidden; border: 0; outline: none; text-decoration: none;" />
      <!--<![endif]-->
    </a>
  </td>
</tr>`.trim();
}

function footerBlock(options: {
  origin: string;
  reason: string;
  links: EmailFooterLink[];
  postalAddress?: string;
}): string {
  const linkMarkup = options.links
    .map(
      (item) =>
        h`<a href="${raw(safeUrl(item.url))}" target="_blank" rel="noopener" class="footer-link" style="color: ${color.body}; text-decoration: underline;">${item.label}</a>`,
    )
    .join(
      h`<span class="subtle" style="color: ${color.subtle};"> &nbsp;·&nbsp; </span>`,
    );

  return `
<tr>
  <td style="padding: 24px 8px 0;">
    <p class="subtle" style="margin: 0 0 10px; font-family: ${font.sans}; font-size: 12px; line-height: 18px; color: ${color.subtle};">${escapeHtml(options.reason)}</p>
    ${linkMarkup ? `<p style="margin: 0 0 10px; font-family: ${font.sans}; font-size: 12px; line-height: 18px; color: ${color.body};">${linkMarkup}</p>` : ""}
    <p class="subtle" style="margin: 0; font-family: ${font.sans}; font-size: 12px; line-height: 18px; color: ${color.subtle};">
      ${escapeHtml(emailBrand.name)} &nbsp;·&nbsp; ${escapeHtml(emailBrand.tagline)}${options.postalAddress ? `<br />${escapeHtml(options.postalAddress)}` : ""}
    </p>
  </td>
</tr>`.trim();
}

/**
 * Dark-mode overrides.
 *
 * `prefers-color-scheme` covers Apple Mail and iOS; the `[data-ogsc]` /
 * `[data-ogsb]` attribute selectors cover Outlook.com, which rewrites the
 * document instead of honouring the media query.
 */
function darkModeStyles(): string {
  const rules = `
  .canvas { background-color: ${dark.canvas} !important; }
  .card { background-color: ${dark.card} !important; border-color: ${dark.border} !important; }
  .ink { color: ${dark.ink} !important; }
  .body { color: ${dark.body} !important; }
  .subtle, .label, .footer-link { color: ${dark.subtle} !important; }
  .footer-link { color: ${dark.body} !important; }
  .rule { background-color: ${dark.border} !important; }
  .rule-b { border-color: ${dark.border} !important; }
  .chip { background-color: ${dark.brandSoft} !important; border-color: ${dark.brandBorder} !important; color: ${dark.brand} !important; }
  .quote { background-color: ${dark.muted} !important; border-color: ${dark.border} !important; color: ${dark.ink} !important; border-left-color: ${dark.brand} !important; }
  .brand-link { color: ${dark.link} !important; }
  .btn-dark { background-color: ${dark.action} !important; color: ${dark.actionText} !important; }
  .btn-brand { background-color: ${dark.brand} !important; color: #1a0c04 !important; }
  .logo-light { display: none !important; width: 0 !important; max-height: 0 !important; overflow: hidden !important; }
  .logo-dark { display: block !important; width: ${emailBrand.logo.width}px !important; max-width: ${emailBrand.logo.width}px !important; max-height: none !important; overflow: visible !important; }`;

  const ogsc = rules
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [selectors, ...rest] = line.split("{");
      const scoped = selectors
        .split(",")
        .map((selector) => `[data-ogsc] ${selector.trim()}`)
        .join(", ");
      return `  ${scoped} { ${rest.join("{")}`;
    })
    .join("\n");

  return `@media (prefers-color-scheme: dark) {\n${rules}\n}\n${ogsc}`;
}

/**
 * Renders a complete, client-safe HTML email.
 *
 * @returns The full HTML document.
 */
export function renderEmail(options: EmailLayoutOptions): string {
  const origin = options.origin.replace(/\/+$/, "");
  const links = options.footerLinks ?? [
    { label: emailBrand.supportEmail, url: `mailto:${emailBrand.supportEmail}` },
    { label: "avenro.se", url: origin },
  ];

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${escapeHtml(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(options.subject)}</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <style>
    table, td, div, h1, p { font-family: Arial, Helvetica, sans-serif !important; }
    .card { border-radius: 0 !important; }
  </style>
  <![endif]-->
  <style>
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; word-spacing: normal; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; }
    a { text-decoration: none; }
    /* Stop Apple Mail and Outlook auto-linking addresses in their own blue. */
    a[x-apple-data-detectors], .unstyled-auto-detected a, u + #body a, #MessageViewBody a {
      color: inherit !important; text-decoration: none !important; font-size: inherit !important;
      font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important;
    }
    @media only screen and (max-width: 620px) {
      .shell { width: 100% !important; }
      .card-pad { padding: 28px 22px !important; }
      .h1 { font-size: 21px !important; line-height: 28px !important; }
      .btn-wrap { width: 100% !important; }
      .detail-label { width: 72px !important; font-size: 12px !important; padding-right: 12px !important; }
      .detail-value { font-size: 14px !important; }
      .btn-dark, .btn-brand { display: block !important; text-align: center !important; }
    }
${darkModeStyles()}
  </style>
</head>
<body id="body" class="canvas" style="margin: 0; padding: 0; background-color: ${color.canvas};">
  ${preheaderBlock(options.preheader)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="canvas" style="background-color: ${color.canvas};">
    <tr>
      <td align="center" style="padding: 40px 16px 48px;">
        <!--[if mso | IE]><table role="presentation" width="${width}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="shell" style="width: 100%; max-width: ${width}px; margin: 0 auto;">
          ${headerBlock(origin)}
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background-color: ${color.card}; border: 1px solid ${color.border}; border-radius: ${radius.card}px; border-collapse: separate; overflow: hidden;">
                <tr>
                  <td height="3" style="height: 3px; line-height: 3px; font-size: 0; background-color: ${color.brand};">&nbsp;</td>
                </tr>
                <tr>
                  <td class="card-pad" style="padding: 36px 40px 34px;">
${options.content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${footerBlock({ origin, reason: options.footerReason, links, postalAddress: options.postalAddress })}
        </table>
        <!--[if mso | IE]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
