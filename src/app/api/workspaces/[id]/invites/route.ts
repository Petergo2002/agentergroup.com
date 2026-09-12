import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { getServerLanguage } from "@/lib/i18n-server";
import {
  buildTeamMemberLimitError,
  getTeamMemberLimitForPlan,
} from "@/lib/plan-limits";
import type { WorkspaceInviteRecord } from "@/lib/types";
import type { PlanTier } from "@/lib/types/subscription";

/** Validates an email address format. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** POST /api/workspaces/[id]/invites — Create and send a workspace invite. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const targetWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === workspaceId,
  );

  if (!targetWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  // Only owner/admin can invite
  const role = targetWorkspace.membership.role;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Only workspace owners or admins can send invites." },
      { status: 403 },
    );
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("workspace_subscriptions")
    .select("plan_tier")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  }

  const planTier = (subscription?.plan_tier ?? "free") as PlanTier;

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  // Prevent self-invite
  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "You cannot invite yourself." }, { status: 400 });
  }

  // Check if already a member
  const { data: existingMembers } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, profile:profiles(email)")
    .eq("workspace_id", workspaceId);

  const alreadyMember = (existingMembers ?? []).some((member: Record<string, unknown>) => {
    const profileData = Array.isArray(member.profile) ? member.profile[0] : member.profile;
    return (profileData as Record<string, unknown>)?.email?.toString().toLowerCase() === email;
  });

  if (alreadyMember) {
    return NextResponse.json({ error: "This person is already a member of this workspace." }, { status: 409 });
  }

  const { data: pendingInvites, error: pendingInvitesError } = await supabase
    .from("workspace_invites")
    .select("id, email")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending");

  if (pendingInvitesError) {
    return NextResponse.json({ error: pendingInvitesError.message }, { status: 500 });
  }

  const existingInvite = (pendingInvites ?? []).find(
    (invite) => invite.email?.toLowerCase() === email,
  );

  if (existingInvite) {
    return NextResponse.json({ error: "An invite for this email is already pending." }, { status: 409 });
  }

  const nonOwnerMemberCount = (existingMembers ?? []).filter(
    (member: Record<string, unknown>) => member.role !== "owner",
  ).length;
  const occupiedSeats = nonOwnerMemberCount + (pendingInvites?.length ?? 0);
  const teamMemberLimit = getTeamMemberLimitForPlan(planTier);

  if (occupiedSeats >= teamMemberLimit) {
    return NextResponse.json(
      { error: buildTeamMemberLimitError(planTier) },
      { status: 403 },
    );
  }

  // Create the invite
  const { data: invite, error: insertError } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email,
      role: "admin",
      invited_by: user.id,
    })
    .select()
    .single();

  if (insertError || !invite) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create invite." },
      { status: 500 },
    );
  }

  const inviteRecord = invite as WorkspaceInviteRecord;
  const appUrl = getAppUrl();
  const inviteLink = `${appUrl}/invite/accept?token=${inviteRecord.token}`;

  // Send invitation email (best-effort — don't fail the request)
  const inviterName = context.profile.full_name ?? user.email ?? "A team member";
  const emailResult = await sendInviteEmail({
    to: email,
    workspaceName: targetWorkspace.workspace.name,
    inviterName,
    inviteToken: inviteRecord.token,
    // The invitee has no account yet, so the inviter's language is the best guess.
    locale: await getServerLanguage(),
  });

  return NextResponse.json({
    invite: inviteRecord,
    inviteLink,
    emailSent: emailResult.success,
    emailError: emailResult.success ? undefined : emailResult.error,
  });
}

/** GET /api/workspaces/[id]/invites — List invites for the workspace. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const targetWorkspace = context.workspaces.find(
    (entry) => entry.workspace.id === workspaceId,
  );

  if (!targetWorkspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const { data: invites, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites: invites ?? [] });
}
