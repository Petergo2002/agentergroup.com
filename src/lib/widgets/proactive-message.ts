/**
 * The proactive teaser shown beside the closed launcher on a customer's site.
 *
 * Dependency-free so it can be unit tested directly, and so the same rule
 * governs the stored widget, the builder draft, and the save handler.
 */
export const PROACTIVE_MESSAGE_MAX_LENGTH = 140;

/**
 * Returns the teaser to publish, or null when there is nothing to show.
 *
 * A disabled or blank teaser is omitted from the public bootstrap payload
 * entirely rather than being sent and hidden on the client, so a host page can
 * never read copy the owner has switched off.
 */
export function resolveProactiveMessage(
  enabled: boolean | null | undefined,
  message: string | null | undefined,
) {
  if (!enabled) return null;
  const trimmed = (message ?? "").trim();
  return trimmed ? trimmed.slice(0, PROACTIVE_MESSAGE_MAX_LENGTH) : null;
}
