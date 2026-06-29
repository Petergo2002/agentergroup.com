import { NextRequest, NextResponse } from "next/server";
import Firecrawl from "@mendable/firecrawl-js";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import {
  normalizeSelectedWebsiteUrls,
  normalizeWebsiteKnowledgeUrl,
} from "@/lib/knowledge-website";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);

  if (context.subscription?.plan_tier !== "premium") {
    return NextResponse.json({ error: "Sitemap mapping is a premium feature." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rawUrl = String(body.url ?? "").trim();

  if (!rawUrl) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  let websiteUrl: URL;
  try {
    websiteUrl = normalizeWebsiteKnowledgeUrl(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL provided." }, { status: 400 });
  }

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) {
    return NextResponse.json({ error: "FIRECRAWL_API_KEY is not configured." }, { status: 500 });
  }

  const firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });

  try {
    if (typeof firecrawl.map !== "function") {
      throw new Error("Firecrawl SDK error: map method not found.");
    }

    const mapResult = await firecrawl.map(websiteUrl.toString(), {
      includeSubdomains: false,
    });
    const mapResultRecord = mapResult as typeof mapResult & {
      success?: boolean;
      error?: string;
    };

    const hasLinks = Array.isArray(mapResult.links);
    const isSuccessful =
      mapResultRecord.success === true ||
      (mapResultRecord.success === undefined && hasLinks);

    if (!isSuccessful) {
      throw new Error(mapResultRecord.error || "Failed to map website.");
    }

    const rawLinks = (mapResult.links ?? []).slice(0, 500);
    const candidateLinks = (rawLinks as unknown[])
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "url" in item && typeof item.url === "string") {
          return item.url;
        }
        return null;
      })
      .filter((url): url is string => url !== null);
    const sameOriginLinks = candidateLinks.filter((candidate) => {
      try {
        return normalizeWebsiteKnowledgeUrl(candidate).origin === websiteUrl.origin;
      } catch {
        return false;
      }
    });
    const links = normalizeSelectedWebsiteUrls(websiteUrl, sameOriginLinks, 500);

    return NextResponse.json({ links });
  } catch (error) {
    console.error("[Firecrawl Map] Failed to map website.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to map website." },
      { status: 500 },
    );
  }
}
