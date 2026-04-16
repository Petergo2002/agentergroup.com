import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST /api/invites/decline — Decline a workspace invite using a token. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
  }

  // Look up the invite — uses the target_select RLS policy
  const { data: invite, error: lookupError } = await supabase
    .from("workspace_invites")
    .select("id, email, status")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (lookupError || !invite) {
    return NextResponse.json(
      { error: "Invite not found or already processed." },
      { status: 404 },
    );
  }

  // Verify email match
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized: email mismatch." }, { status: 403 });
  }

  // Update using admin client since the user doesn't have RLS rights to update the invite
  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("workspace_invites")
    .update({ status: "revoked" }) // Treat declined as revoked/dead
    .eq("id", invite.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ declined: true });
}
