import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { errorResponse, successResponse } from "@/lib/app/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminUser();
  const { id } = await params;
  const admin = createAdminClient();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();
  const rejectionReason = String(body.rejectionReason ?? "").trim();

  if (action !== "approve" && action !== "reject") {
    return errorResponse("action must be approve or reject.", 400);
  }

  if (action === "reject" && !rejectionReason) {
    return errorResponse("rejectionReason is required when rejecting a template.", 400);
  }

  const now = new Date().toISOString();
  const update =
    action === "approve"
      ? {
          status: "approved",
          reviewed_by: user.id,
          approved_at: now,
          rejected_at: null,
          rejection_reason: null,
        }
      : {
          status: "rejected",
          reviewed_by: user.id,
          approved_at: null,
          rejected_at: now,
          rejection_reason: rejectionReason,
        };

  const { data, error } = await admin
    .from("agent_library_templates")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(error.message, 500);
  }

  if (!data) {
    return errorResponse("Template not found.", 404);
  }

  return successResponse({ template: data });
}
