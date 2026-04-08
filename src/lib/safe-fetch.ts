import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const PRIVATE_ADDRESS_BLOCKLIST = new BlockList();

PRIVATE_ADDRESS_BLOCKLIST.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_ADDRESS_BLOCKLIST.addAddress("::1", "ipv6");
PRIVATE_ADDRESS_BLOCKLIST.addSubnet("fc00::", 7, "ipv6");

export const SAFE_DOWNLOAD_HOST_ALLOWLIST = [
  "amazonaws.com",
  "drive.usercontent.google.com",
  "googleusercontent.com",
  "googleapis.com",
  "storage.googleapis.com",
] as const;

const DEFAULT_MAX_REDIRECTS = 5;

type LookupFunction = typeof lookup;

export class SafeFetchError extends Error {
  code:
    | "INVALID_URL"
    | "UNSAFE_SCHEME"
    | "PRIVATE_ADDRESS_BLOCKED"
    | "HOST_NOT_ALLOWED"
    | "DNS_RESOLUTION_FAILED"
    | "TOO_MANY_REDIRECTS"
    | "INVALID_REDIRECT";

  constructor(
    code: SafeFetchError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

function normalizeHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1);
  }

  return normalized;
}

function isAllowedDownloadHost(hostname: string) {
  const normalized = normalizeHostname(hostname);
  return SAFE_DOWNLOAD_HOST_ALLOWLIST.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

function isPrivateAddress(address: string) {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);

  if (family === 4) {
    return PRIVATE_ADDRESS_BLOCKLIST.check(normalized, "ipv4");
  }

  if (family === 6) {
    return PRIVATE_ADDRESS_BLOCKLIST.check(normalized, "ipv6");
  }

  return false;
}

async function resolveHostnameAddresses(
  hostname: string,
  lookupImpl: LookupFunction,
) {
  const normalized = normalizeHostname(hostname);

  if (!normalized) {
    throw new SafeFetchError(
      "INVALID_URL",
      "Remote download URL must include a hostname.",
    );
  }

  if (isIP(normalized)) {
    return [normalized];
  }

  try {
    const resolved = await lookupImpl(normalized, { all: true, verbatim: true });
    return resolved.map((entry) => entry.address);
  } catch {
    throw new SafeFetchError(
      "DNS_RESOLUTION_FAILED",
      "Remote download hostname could not be resolved safely.",
    );
  }
}

async function validateSafeUrl(
  urlString: string,
  lookupImpl: LookupFunction,
) {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    throw new SafeFetchError(
      "INVALID_URL",
      "Remote download URL is invalid.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError(
      "UNSAFE_SCHEME",
      "Remote download URL must use http or https.",
    );
  }

  const addresses = await resolveHostnameAddresses(url.hostname, lookupImpl);

  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new SafeFetchError(
      "PRIVATE_ADDRESS_BLOCKED",
      "Remote download URL resolves to a private or loopback address.",
    );
  }

  if (!isAllowedDownloadHost(url.hostname)) {
    throw new SafeFetchError(
      "HOST_NOT_ALLOWED",
      "Remote download hostname is not allowlisted.",
    );
  }

  return url;
}

export async function fetchSafeRemoteResource(
  urlString: string,
  options?: RequestInit & {
    fetchImpl?: typeof fetch;
    lookupImpl?: LookupFunction;
    maxRedirects?: number;
  },
): Promise<Response> {
  const {
    fetchImpl = fetch,
    lookupImpl = lookup,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    ...requestInit
  } = options ?? {};

  let currentUrl = urlString;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const validatedUrl = await validateSafeUrl(currentUrl, lookupImpl);
    const response = await fetchImpl(validatedUrl, {
      ...requestInit,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount === maxRedirects) {
        throw new SafeFetchError(
          "TOO_MANY_REDIRECTS",
          "Remote download exceeded the maximum redirect limit.",
        );
      }

      const location = response.headers.get("location");

      if (!location) {
        throw new SafeFetchError(
          "INVALID_REDIRECT",
          "Remote download redirect was missing a location header.",
        );
      }

      currentUrl = new URL(location, validatedUrl).toString();
      continue;
    }

    return response;
  }

  throw new SafeFetchError(
    "TOO_MANY_REDIRECTS",
    "Remote download exceeded the maximum redirect limit.",
  );
}

export async function fetchSafeDownloadBytes(
  urlString: string,
  options?: {
    fetchImpl?: typeof fetch;
    lookupImpl?: LookupFunction;
    maxRedirects?: number;
  },
) {
  const response = await fetchSafeRemoteResource(urlString, {
    fetchImpl: options?.fetchImpl,
    lookupImpl: options?.lookupImpl,
    maxRedirects: options?.maxRedirects,
  });

  if (!response.ok) {
    throw new Error("Remote download returned an unreadable file URL.");
  }

  return new Uint8Array(await response.arrayBuffer());
}
