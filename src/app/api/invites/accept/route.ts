import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST /api/invites/accept — Accept a workspace invite using a token. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();

  if (!token) {
    return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
  }

  // Look up the invite — uses the target_select RLS policy (email match)
  const { data: invite, error: lookupError } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (lookupError || !invite) {
    return NextResponse.json(
      { error: "Invite not found, already accepted, or expired." },
      { status: 404 },
    );
  }

  // Check expiration
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  // Verify email match
  const userEmail = user.email?.toLowerCase();
  const inviteEmail = invite.email?.toLowerCase();

  if (!userEmail || userEmail !== inviteEmail) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${invite.email}. Please log in with that email to accept it.`,
      },
      { status: 403 },
    );
  }

  // Check if already a member (idempotency)
  const adminClient = createAdminClient();

  const { data: existingMember } = await adminClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    // Already a member — mark invite as accepted and return success
    await adminClient
      .from("workspace_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    const response = NextResponse.json({
      accepted: true,
      workspaceId: invite.workspace_id,
      alreadyMember: true,
    });

    response.cookies.set("active_workspace_id", invite.workspace_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  }

  // Insert workspace membership using service role (bypasses RLS)
  const { error: memberError } = await adminClient
    .from("workspace_members")
    .insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
    });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Mark invite as accepted
  await adminClient
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  const response = NextResponse.json({
    accepted: true,
    workspaceId: invite.workspace_id,
    alreadyMember: false,
  });

  // Switch to the new workspace
  response.cookies.set("active_workspace_id", invite.workspace_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
