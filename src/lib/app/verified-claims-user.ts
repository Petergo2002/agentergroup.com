import type { User } from "@supabase/supabase-js";

/**
 * Builds the `User` shape the workspace bootstrap needs from verified JWT
 * claims.
 *
 * `auth.getUser()` always calls the Supabase Auth server, which on every
 * authenticated render put a full network round trip in front of any data
 * fetching. `auth.getClaims()` verifies the token's signature locally against
 * the project's published ES256 key, so identity is still cryptographically
 * established — it is not read from an untrusted cookie.
 *
 * The trade-off is revocation latency: a signed-out or revoked session stays
 * usable until its access token expires. Reads accept that; anything
 * destructive or privileged should still confirm with `auth.getUser()`.
 */
export interface VerifiedClaims {
  sub?: unknown;
  email?: unknown;
  phone?: unknown;
  user_metadata?: unknown;
  app_metadata?: unknown;
  [key: string]: unknown;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildUserFromVerifiedClaims(
  claims: VerifiedClaims | null | undefined,
): User | null {
  const id = typeof claims?.sub === "string" ? claims.sub : null;

  if (!id) {
    return null;
  }

  const appMetadata = readRecord(claims?.app_metadata);

  return {
    id,
    email: typeof claims?.email === "string" ? claims.email : undefined,
    phone: typeof claims?.phone === "string" ? claims.phone : undefined,
    user_metadata: readRecord(claims?.user_metadata),
    app_metadata: {
      ...appMetadata,
      provider:
        typeof appMetadata.provider === "string"
          ? appMetadata.provider
          : undefined,
    },
    aud: typeof claims?.aud === "string" ? claims.aud : "authenticated",
    // Only the fields the workspace bootstrap reads are meaningful here; the
    // rest of the User surface is not reconstructed from a token.
    created_at: "",
  } as User;
}
