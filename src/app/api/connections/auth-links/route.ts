import { NextResponse } from "next/server";
import {
  buildConnectionAuthLinkUrl,
  CONNECTION_AUTH_LINK_EXPIRY_DAYS,
  generateConnectionAuthLinkToken,
  hashConnectionAuthLinkToken,
} from "@/lib/connection-auth-links";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { getSupportedIntegration } from "@/lib/integrations";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceAdminRole } from "@/lib/workspace-security";
import type { ConnectionAuthLinkRecord } from "@/lib/types";

const AUTH_LINK_SELECT =
  "id, workspace_id, toolkit_slug, created_by, status, expires_at, completed_connection_id, created_at, updated_at";

function toAuthLinkPayload(link: Partial<ConnectionAuthLinkRecord>) {
  return {
    id: link.id,
    workspace_id: link.workspace_id,
    toolkit_slug: link.toolkit_slug,
    created_by: link.created_by,
    status: link.status,
    expires_at: link.expires_at,
    completed_connection_id: link.completed_connection_id,
    created_at: link.created_at,
    updated_at: link.updated_at,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  if (!isWorkspaceAdminRole(context.membership.role)) {
    return NextResponse.json(
      { error: "Only workspace owners or admins can manage connection links." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("connection_auth_links")
    .select(AUTH_LINK_SELECT)
    .eq("workspace_id", context.workspace.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    authLinks: (data ?? []).map((link) =>
      toAuthLinkPayload(link as Partial<ConnectionAuthLinkRecord>),
    ),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  if (!isWorkspaceAdminRole(context.membership.role)) {
    return NextResponse.json(
      { error: "Only workspace owners or admins can create connection links." },
      { status: 403 },
    );
  }

  if (!context.subscription?.integrations_enabled) {
    return NextResponse.json(
      { error: "Connection auth links are available on workspaces with integrations enabled." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const toolkitSlug = String(body.toolkitSlug ?? "").trim().toLowerCase();
  const toolkit = getSupportedIntegration(toolkitSlug);

  if (!toolkit) {
    return NextResponse.json({ error: "Unsupported integration." }, { status: 400 });
  }

  const token = generateConnectionAuthLinkToken();
  const expiresAt = new Date(
    Date.now() + CONNECTION_AUTH_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("connection_auth_links")
    .insert({
      workspace_id: context.workspace.id,
      toolkit_slug: toolkit.slug,
      created_by: user.id,
      token_hash: hashConnectionAuthLinkToken(token),
      expires_at: expiresAt,
    })
    .select(AUTH_LINK_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create connection auth link." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    authLink: toAuthLinkPayload(data as Partial<ConnectionAuthLinkRecord>),
    link: buildConnectionAuthLinkUrl(token),
    expiresAt,
  });
}
