import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { buildUserFromVerifiedClaims } from "./verified-claims-user.ts";

type AuthClientLike = {
  auth: Pick<SupabaseClient["auth"], "getClaims" | "getSession">;
};

export interface VerifiedApiIdentity {
  user: User | null;
  session: Session | null;
}

/**
 * Establishes the caller's identity for a route handler.
 *
 * `auth.getSession()` reads the session straight out of the cookie and only
 * shape-checks it, so `session.user` is attacker-controlled — auth-js itself
 * wraps that object in a warning proxy on the server for exactly this reason.
 * Handlers must never take an identity from it.
 *
 * The session is still needed for its `access_token`, which several handlers
 * forward to downstream services, so it is read first and then verified:
 * `getClaims()` checks that exact token's signature against the project's
 * published ES256 key (falling back to the Auth server for symmetric keys).
 * Identity therefore comes from the verified token payload, and the token the
 * caller forwards is the same one that was verified.
 *
 * This keeps the round trip that `auth.getUser()` would add while leaving
 * identity cryptographically established. Fails closed: any verification
 * failure returns no user and no session.
 *
 * The revocation trade-off matches the RSC render path — a signed-out or
 * revoked session stays usable until its access token expires — so privileged
 * or destructive operations should still confirm with `auth.getUser()`.
 */
export async function getVerifiedApiIdentity(
  supabase: AuthClientLike,
): Promise<VerifiedApiIdentity> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { user: null, session: null };
  }

  const { data, error } = await supabase.auth.getClaims(session.access_token);

  if (error) {
    return { user: null, session: null };
  }

  const user = buildUserFromVerifiedClaims(data?.claims);

  if (!user) {
    return { user: null, session: null };
  }

  return { user, session };
}
