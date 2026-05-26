import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ProfileRecord } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = Pick<SupabaseClient<any>, "from">;

interface DatabaseError {
  code?: string;
}

function titleFromEmail(email?: string | null) {
  if (!email) {
    return "Agentergroup";
  }

  const [prefix] = email.split("@");
  const cleaned = prefix.replace(/[._-]+/g, " ").trim();

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function buildProfilePayload(user: User): ProfileRecord {
  return {
    id: user.id,
    email: user.email ?? null,
    full_name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      titleFromEmail(user.email),
    avatar_url: user.user_metadata?.avatar_url ?? null,
  };
}

export function profileNeedsSync(
  profile: ProfileRecord | null,
  payload: ProfileRecord,
) {
  return (
    !profile ||
    profile.email !== payload.email ||
    profile.full_name !== payload.full_name ||
    profile.avatar_url !== payload.avatar_url
  );
}

function isDuplicateKeyError(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function loadProfileById(
  supabase: SupabaseLike,
  userId: string,
) {
  const result = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? null) as ProfileRecord | null;
}

async function updateProfile(
  supabase: SupabaseLike,
  payload: ProfileRecord,
) {
  const result = await supabase
    .from("profiles")
    .update({
      email: payload.email,
      full_name: payload.full_name,
      avatar_url: payload.avatar_url,
    })
    .eq("id", payload.id)
    .select("id, email, full_name, avatar_url")
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Failed to update profile.");
  }

  return result.data as ProfileRecord;
}

export async function syncUserProfile(
  supabase: SupabaseLike,
  user: User,
): Promise<ProfileRecord> {
  const profilePayload = buildProfilePayload(user);
  const existingProfile = await loadProfileById(supabase, user.id);

  if (existingProfile && !profileNeedsSync(existingProfile, profilePayload)) {
    return existingProfile;
  }

  if (existingProfile) {
    return updateProfile(supabase, profilePayload);
  }

  const insertResult = await supabase
    .from("profiles")
    .insert(profilePayload)
    .select("id, email, full_name, avatar_url")
    .single();

  if (!insertResult.error && insertResult.data) {
    return insertResult.data as ProfileRecord;
  }

  if (isDuplicateKeyError(insertResult.error)) {
    const concurrentProfile = await loadProfileById(supabase, user.id);
    if (concurrentProfile && !profileNeedsSync(concurrentProfile, profilePayload)) {
      return concurrentProfile;
    }
    return updateProfile(supabase, profilePayload);
  }

  throw insertResult.error ?? new Error("Failed to create profile.");
}
