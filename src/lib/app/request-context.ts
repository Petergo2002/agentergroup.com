import "server-only";

import { cache } from "react";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { loadRequestContext } from "@/lib/app/request-context-core";
import { createClient } from "@/lib/supabase/server";

async function loadAppRequestContext() {
  return loadRequestContext({
    createSupabaseClient: createClient,
    getUser: async (supabase) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      return user;
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
