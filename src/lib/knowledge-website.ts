export const MAX_WEBSITE_KNOWLEDGE_PAGES = 30;

export function normalizeWebsiteKnowledgeUrl(value: string) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Website URL must use HTTP or HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Website URL cannot include credentials.");
  }

  url.hash = "";
  return url;
}

export function normalizeSelectedWebsiteUrls(
  baseUrl: URL,
  values: unknown,
  maxUrls = MAX_WEBSITE_KNOWLEDGE_PAGES,
) {
  if (!Array.isArray(values)) {
    return [];
  }

  const selectedUrls: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const candidate = normalizeWebsiteKnowledgeUrl(value);

    if (candidate.origin !== baseUrl.origin) {
      throw new Error("Selected URLs must belong to the website origin.");
    }

    const normalized = candidate.toString();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      selectedUrls.push(normalized);
    }

    if (selectedUrls.length > maxUrls) {
      throw new Error(
        `A maximum of ${maxUrls} website pages can be processed at once.`,
      );
    }
  }

  return selectedUrls;
}
