export type RequestContextResult<TClient, TUser, TContext> =
  | {
      supabase: TClient;
      user: null;
      context: null;
    }
  | {
      supabase: TClient;
      user: TUser;
      context: TContext;
    };

export interface RequestContextDependencies<TClient, TUser, TContext> {
  createSupabaseClient: () => Promise<TClient>;
  getUser: (supabase: TClient) => Promise<TUser | null>;
  ensureWorkspace: (supabase: TClient, user: TUser) => Promise<TContext>;
}

/**
 * Loads the authenticated application context once. Request-scoped memoization
 * is applied by the server-only wrapper so this function remains unit testable.
 */
export async function loadRequestContext<TClient, TUser, TContext>(
  dependencies: RequestContextDependencies<TClient, TUser, TContext>,
): Promise<RequestContextResult<TClient, TUser, TContext>> {
  const supabase = await dependencies.createSupabaseClient();
  const user = await dependencies.getUser(supabase);

  if (!user) {
    return {
      supabase,
      user: null,
      context: null,
    };
  }

  const context = await dependencies.ensureWorkspace(supabase, user);

  return {
    supabase,
    user,
    context,
  };
}
