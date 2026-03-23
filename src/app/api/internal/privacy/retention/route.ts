import { NextRequest, NextResponse } from "next/server";
import {
  getGdprRetentionCronSecret,
  hasGdprRetentionCronSecret,
} from "@/lib/env";
import { purgeExpiredWidgetData } from "@/lib/privacy";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(/\s+/, 2);

  if (scheme !== "Bearer" || !token) {
    return false;
  }

  return token === getGdprRetentionCronSecret();
}

export async function POST(request: NextRequest) {
  if (!hasGdprRetentionCronSecret()) {
    return NextResponse.json(
      { error: "GDPR retention cron secret is not configured." },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const supabase = createAdminClient();
    const summary = await purgeExpiredWidgetData(supabase, { dryRun });

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run retention purge.",
      },
      { status: 500 },
    );
  }
}
