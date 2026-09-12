/**
 * Reusable building blocks for Avenro transactional emails.
 *
 * Everything here is table-based and inline-styled on purpose: Outlook on
 * Windows renders with Word's HTML engine, Gmail strips `<style>` for some
 * clients, and neither supports flexbox, grid or CSS custom properties.
 */

import { emailTheme } from "./theme.ts";
import { escapeHtml, h, raw, safeUrl } from "./html.ts";

const { color, font, radius } = emailTheme;

/** Small uppercase status chip, e.g. "Milo · New request". */
export function chip(label: string): string {
  return h`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px;"><tr><td class="chip" style="padding: 5px 11px; background-color: ${color.brandSoft}; border: 1px solid ${color.brandBorder}; border-radius: ${raw(String(radius.chip))}px; font-family: ${raw(font.sans)}; font-size: 11px; line-height: 14px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: ${color.brandStrong}; white-space: nowrap;">${label}</td></tr></table>`;
}

/** Page heading — one per email. */
export function heading(text: string): string {
  return h`<h1 class="ink h1" style="margin: 0 0 10px; font-family: ${raw(font.sans)}; font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.02em; color: ${color.ink};">${text}</h1>`;
}

/**
 * Body paragraph.
 *
 * @param html - Trusted markup; escape user input before passing it in.
 */
export function paragraph(html: string, options: { muted?: boolean; small?: boolean } = {}): string {
  const size = options.small ? "13px" : "15px";
  const height = options.small ? "20px" : "24px";
  const tone = options.muted ? color.subtle : color.body;
  const cls = options.muted ? "subtle" : "body";
  return h`<p class="${cls}" style="margin: 0 0 18px; font-family: ${raw(font.sans)}; font-size: ${raw(size)}; line-height: ${raw(height)}; color: ${raw(tone)};">${raw(html)}</p>`;
}

/** Emphasises a value inside a paragraph without changing its size. */
export function strong(text: string): string {
  return h`<strong class="ink" style="color: ${color.ink}; font-weight: 600;">${text}</strong>`;
}

/** Inline link in brand orange. */
export function link(href: string, label: string): string {
  return h`<a href="${raw(safeUrl(href))}" class="brand-link" style="color: ${color.link}; text-decoration: none; font-weight: 600;">${label}</a>`;
}

/** Hairline rule between sections. */
export function divider(spacing = 24): string {
  return h`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: ${raw(String(spacing))}px 0;"><tr><td class="rule" style="height: 1px; line-height: 1px; font-size: 0; background-color: ${color.border};">&nbsp;</td></tr></table>`;
}

/**
 * Primary call to action.
 *
 * Ships a VML rectangle for Outlook (which ignores padding on anchors and
 * border-radius entirely) alongside the normal anchor for every other client.
 */
export function button(options: { label: string; url: string; tone?: "dark" | "brand" }): string {
  const tone = options.tone ?? "dark";
  const fill = tone === "brand" ? color.brand : color.action;
  const labelColor = tone === "brand" ? "#ffffff" : color.actionText;
  const cls = tone === "brand" ? "btn-brand" : "btn-dark";
  // Outlook's VML needs a fixed pixel width; approximate it from the label.
  const vmlWidth = Math.min(420, Math.max(190, options.label.length * 9 + 56));
  const href = safeUrl(options.url);

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-wrap" style="margin: 4px 0 20px;">
  <tr>
    <td align="left">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="21%" stroke="f" fillcolor="${fill}">
        <w:anchorlock/>
        <center style="color:${labelColor};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(options.label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${href}" target="_blank" rel="noopener" class="${cls}" style="display: inline-block; padding: 14px 26px; background-color: ${fill}; border-radius: ${radius.control}px; font-family: ${font.sans}; font-size: 15px; line-height: 20px; font-weight: 600; color: ${labelColor}; text-decoration: none; letter-spacing: -0.01em;">${escapeHtml(options.label)}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

/**
 * The "button didn't work" fallback every good transactional email carries.
 *
 * @param label - Localised lead-in sentence.
 */
export function urlFallback(label: string, url: string): string {
  return h`<p class="subtle" style="margin: 0 0 4px; font-family: ${raw(font.sans)}; font-size: 12px; line-height: 18px; color: ${color.subtle};">${label}</p>
<p style="margin: 0 0 4px; font-family: ${raw(font.mono)}; font-size: 12px; line-height: 18px; word-break: break-all;"><a href="${raw(safeUrl(url))}" class="brand-link" style="color: ${color.link}; text-decoration: underline;">${url}</a></p>`;
}

/** Key/value rows — contact details, invite metadata, plan changes. */
export function detailRows(rows: Array<{ label: string; value: string }>): string {
  const body = rows
    .map(
      (row, index) => h`<tr>
      <td class="label rule-b detail-label" style="padding: ${raw(index === 0 ? "0" : "12px")} 16px 12px 0; border-bottom: 1px solid ${color.border}; font-family: ${raw(font.sans)}; font-size: 13px; line-height: 18px; color: ${color.subtle}; white-space: nowrap; vertical-align: top; width: 96px;">${row.label}</td>
      <td class="ink rule-b detail-value" style="padding: ${raw(index === 0 ? "0" : "12px")} 0 12px; border-bottom: 1px solid ${color.border}; font-family: ${raw(font.sans)}; font-size: 15px; line-height: 22px; font-weight: 600; color: ${color.ink}; vertical-align: top; word-break: break-word;">${raw(row.value)}</td>
    </tr>`,
    )
    .join("\n");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px; border-collapse: collapse;">\n${body}\n</table>`;
}

/** Quoted visitor message or other verbatim content. */
export function quote(label: string, html: string): string {
  return h`<p class="label" style="margin: 0 0 8px; font-family: ${raw(font.sans)}; font-size: 11px; line-height: 14px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: ${color.subtle};">${label}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px; border-collapse: separate;">
  <tr>
    <td class="quote" style="padding: 14px 18px; background-color: ${color.muted}; border-left: 3px solid ${color.brand}; border-radius: 0 ${raw(String(radius.control))}px ${raw(String(radius.control))}px 0; font-family: ${raw(font.sans)}; font-size: 15px; line-height: 23px; color: ${color.ink};">${raw(html)}</td>
  </tr>
</table>`;
}

/**
 * Large monospace one-time code, letter-spaced for readability.
 *
 * @param codeHtml - Trusted markup (a literal code or a template placeholder).
 */
export function codeBlock(codeHtml: string): string {
  return h`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 22px; border-collapse: separate;">
  <tr>
    <td align="center" class="quote" style="padding: 18px 20px; background-color: ${color.muted}; border: 1px solid ${color.border}; border-radius: ${raw(String(radius.control))}px; font-family: ${raw(font.mono)}; font-size: 30px; line-height: 38px; font-weight: 700; letter-spacing: 0.24em; color: ${color.ink};">${raw(codeHtml)}</td>
  </tr>
</table>`;
}

/** Low-key note under the main content, e.g. expiry or "ignore this email". */
export function note(html: string): string {
  return h`<p class="subtle" style="margin: 0; font-family: ${raw(font.sans)}; font-size: 13px; line-height: 20px; color: ${color.subtle};">${raw(html)}</p>`;
}
