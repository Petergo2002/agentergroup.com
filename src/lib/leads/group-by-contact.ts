import type { WidgetLeadListItem } from "@/lib/types";

export interface LeadContactGroup {
  /** Stable identity for this contact within the list. */
  key: string;
  /** Best real name across the captures, or null when none was ever given. */
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Every capture for this contact, newest first. */
  captures: WidgetLeadListItem[];
  captureCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  chatCount: number;
  contactFormCount: number;
  /** More than one conversation — a returning prospect, not clutter. */
  isReturning: boolean;
}

/**
 * The extractor's stand-in when a chat never reveals a name. It is not a name,
 * so it must never win over one the visitor actually gave.
 */
const PLACEHOLDER_NAMES = new Set(["website visitor"]);

export function normalizeEmail(value: string | null | undefined) {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed || null;
}

/**
 * Formatting only — never a guess at country code.
 *
 * "0723220417" and "+46723220417" are probably the same Swedish number, but
 * inferring that requires assuming a country, and a wrong assumption merges two
 * different people into one contact and shows one visitor's conversations under
 * another's name. A missed merge is a cosmetic problem; a false merge is a
 * privacy one, so this only strips punctuation.
 */
export function normalizePhone(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  return hasPlus ? `+${digits}` : digits;
}

function isRealName(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && !PLACEHOLDER_NAMES.has(trimmed.toLowerCase());
}

/**
 * Groups captures into the people who made them.
 *
 * A visitor who comes back three times is one prospect with three
 * conversations, not three leads. Grouping also merges what each capture knew
 * separately: the name from one, the phone from another, so the contact row can
 * show details no single capture holds.
 */
export function groupLeadsByContact(
  leads: WidgetLeadListItem[],
): LeadContactGroup[] {
  const groups = new Map<string, LeadContactGroup>();

  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    const phone = normalizePhone(lead.phone);

    // Without an email or a phone there is nothing to match on. Such captures
    // stay separate rather than collapsing into one anonymous pile — they are
    // unidentified, not the same person.
    const key = email
      ? `email:${email}`
      : phone
        ? `phone:${phone}`
        : `lead:${lead.id}`;

    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        name: isRealName(lead.name) ? lead.name.trim() : null,
        email: lead.email?.trim() || null,
        phone: lead.phone?.trim() || null,
        captures: [lead],
        captureCount: 1,
        firstSeenAt: lead.created_at,
        lastSeenAt: lead.created_at,
        chatCount: lead.source_channel === "contact_form" ? 0 : 1,
        contactFormCount: lead.source_channel === "contact_form" ? 1 : 0,
        isReturning: false,
      });
      continue;
    }

    existing.captures.push(lead);
    existing.captureCount += 1;
    existing.isReturning = true;

    if (lead.created_at < existing.firstSeenAt) {
      existing.firstSeenAt = lead.created_at;
    }

    const isNewer = lead.created_at > existing.lastSeenAt;
    if (isNewer) {
      existing.lastSeenAt = lead.created_at;
    }

    // Prefer the most recent real value, but never let a newer blank erase
    // something an earlier capture recorded.
    if (isRealName(lead.name) && (isNewer || !existing.name)) {
      existing.name = lead.name.trim();
    }
    if (lead.email?.trim() && (isNewer || !existing.email)) {
      existing.email = lead.email.trim();
    }
    if (lead.phone?.trim() && (isNewer || !existing.phone)) {
      existing.phone = lead.phone.trim();
    }

    if (lead.source_channel === "contact_form") {
      existing.contactFormCount += 1;
    } else {
      existing.chatCount += 1;
    }
  }

  const ordered = Array.from(groups.values());

  for (const group of ordered) {
    group.captures.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // Most recently active contact first: the one worth calling today.
  ordered.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  return ordered;
}
