import { NextResponse } from "next/server";
import { loadDashboardSummary } from "@/lib/dashboard/summary";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadDashboardSummary(supabase as never, user));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load dashboard summary.",
      },
      { status: 500 },
    );
  }
}
