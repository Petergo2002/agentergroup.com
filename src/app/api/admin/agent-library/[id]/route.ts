import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { errorResponse, successResponse } from "@/lib/app/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdminUser();
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("agent_library_templates")
    .delete()
    .eq("id", id)
    .select("id, name, status")
    .maybeSingle();

  if (error) {
    return errorResponse(error.message, 500);
  }

  if (!data) {
    return errorResponse("Template not found.", 404);
  }

  return successResponse({ template: data });
}
