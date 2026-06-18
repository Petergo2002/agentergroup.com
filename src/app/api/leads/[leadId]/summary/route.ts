import { NextResponse } from "next/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  generateLeadConversationSummary,
  LeadSummaryNotAvailableError,
} from "@/lib/leads/conversation-summary";
import { MessageLimitExceededError } from "@/lib/message-usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;

  if (!UUID_PATTERN.test(leadId)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const context = await ensureWorkspaceContext(supabase as never, user);
    const result = await generateLeadConversationSummary(createAdminClient(), {
      leadId,
      expectedWorkspaceId: context.workspace.id,
      force: true,
    });

    if (!result) {
      throw new LeadSummaryNotAvailableError("Lead not found.");
    }

    return NextResponse.json(result.summary, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof MessageLimitExceededError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof LeadSummaryNotAvailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Lead conversation summary generation failed.", {
      leadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to generate the AI summary right now." },
      { status: 500 },
    );
  }
}
