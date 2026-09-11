import "server-only";

import { cache } from "react";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { loadRequestContext } from "@/lib/app/request-context-core";
import { buildUserFromVerifiedClaims } from "@/lib/app/verified-claims-user";
import { createClient } from "@/lib/supabase/server";

async function loadAppRequestContext() {
  return loadRequestContext({
    createSupabaseClient: createClient,
    // Verified locally against the project's ES256 signing key rather than by
    // calling the Auth server, which removes a network round trip from the
    // front of every authenticated render. Identity is still established
    // cryptographically; see buildUserFromVerifiedClaims for the trade-off.
    getUser: async (supabase) => {
      const { data, error } = await supabase.auth.getClaims();

      if (error) {
        return null;
      }

      return buildUserFromVerifiedClaims(data?.claims);
    },
    ensureWorkspace: (supabase, user) =>
      ensureWorkspaceContext(supabase as never, user),
  });
}

/**
 * Returns the authenticated user and active workspace for the current App
 * Router request. React cache is request-scoped and never shares this value
 * between users, sessions, or workspace-switch requests.
 */
export const getAppRequestContext = cache(loadAppRequestContext);
