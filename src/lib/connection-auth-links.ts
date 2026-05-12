import crypto from "node:crypto";
import { getAppUrl } from "@/lib/env";

export const CONNECTION_AUTH_LINK_EXPIRY_DAYS = 7;

export function generateConnectionAuthLinkToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashConnectionAuthLinkToken(token: string) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function buildConnectionAuthLinkUrl(token: string) {
  return `${getAppUrl()}/connect/${encodeURIComponent(token)}`;
}

export function isConnectionAuthLinkExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}
