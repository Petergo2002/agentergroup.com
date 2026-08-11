import { NextResponse, type NextRequest } from "next/server";
import {
  createLegalConsentToken,
  type LegalAcceptanceMethod,
} from "@/lib/legal-consent";

export const dynamic = "force-dynamic";

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return noStoreJson({ error: "Invalid request origin." }, 403);
  }

  let body: { accepted?: unknown; method?: unknown };
  try {
    body = (await request.json()) as { accepted?: unknown; method?: unknown };
  } catch {
    return noStoreJson({ error: "Invalid request body." }, 400);
  }

  if (body.accepted !== true || body.method !== "google_oauth") {
    return noStoreJson(
      { error: "You must agree before creating an account." },
      400,
    );
  }

  const method: LegalAcceptanceMethod = body.method;
  return noStoreJson({ token: createLegalConsentToken(method) });
}
