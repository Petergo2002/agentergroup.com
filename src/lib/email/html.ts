/**
 * Escaping primitives shared by every email template.
 *
 * Transactional emails interpolate names, messages and workspace titles that
 * come straight from end users, so the default has to be "escaped" and raw
 * markup has to be opted into explicitly.
 */

const RAW_MARKER = Symbol("email.raw");

type RawHtml = { readonly [RAW_MARKER]: string };

/** Escapes HTML special characters so user input cannot inject markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Marks a string as trusted markup so `h` interpolates it verbatim.
 *
 * @param value - Markup produced by this module, never raw user input.
 * @returns A value `h` will not escape.
 */
export function raw(value: string): RawHtml {
  return { [RAW_MARKER]: value };
}

function isRaw(value: unknown): value is RawHtml {
  return typeof value === "object" && value !== null && RAW_MARKER in value;
}

/**
 * Tagged template that escapes every interpolation unless wrapped in `raw`.
 *
 * @returns The assembled markup.
 */
export function h(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((out, chunk, index) => {
    if (index === 0) return chunk;
    const value = values[index - 1];
    if (value === null || value === undefined || value === false) return out + chunk;
    const rendered = isRaw(value) ? value[RAW_MARKER] : escapeHtml(String(value));
    return out + rendered + chunk;
  }, "");
}

/**
 * Supabase Auth templates are Go templates, so `{{ .ConfirmationURL }}` is a
 * legitimate href value that only becomes a real URL inside Supabase.
 */
const GO_TEMPLATE_URL = /^\{\{\s*\.[A-Za-z]+\s*\}\}$/;

/** Escapes a URL for use in an `href`, rejecting anything but http(s), mailto and tel. */
export function safeUrl(value: string): string {
  const trimmed = value.trim();
  if (GO_TEMPLATE_URL.test(trimmed)) {
    return trimmed;
  }
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return "#";
  }
  return escapeHtml(trimmed);
}

/** Converts newlines in already-escaped text into `<br />` tags. */
export function nl2br(escaped: string): string {
  return escaped.replace(/\r\n|\r|\n/g, "<br />");
}
