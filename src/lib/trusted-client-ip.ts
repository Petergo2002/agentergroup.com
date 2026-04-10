import { isIP } from "node:net";

export interface HeaderLookup {
  get(name: string): string | null;
}

export const TRUSTED_CLIENT_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
] as const;

function lastForwardedToken(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1) ?? "";
}

function trimIpDecorators(candidate: string) {
  const trimmed = candidate.trim().replace(/^"|"$/g, "");

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }

  if (isIP(trimmed)) {
    return trimmed;
  }

  const ipv4WithoutPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithoutPort?.[1] && isIP(ipv4WithoutPort[1])) {
    return ipv4WithoutPort[1];
  }

  return trimmed;
}

function normalizeIpCandidate(candidate: string | null | undefined) {
  if (!candidate) {
    return null;
  }

  const normalized = trimIpDecorators(candidate);
  if (!normalized) {
    return null;
  }

  return isIP(normalized) ? normalized.toLowerCase() : null;
}

export function resolveTrustedClientIp(headers: HeaderLookup) {
  for (const header of TRUSTED_CLIENT_IP_HEADERS) {
    const raw = headers.get(header);
    if (!raw) {
      continue;
    }

    const normalized = normalizeIpCandidate(lastForwardedToken(raw));
    if (normalized) {
      return normalized;
    }
  }

  return null;
}
