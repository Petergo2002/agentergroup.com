import { NextRequest, NextResponse } from "next/server";
import Firecrawl from "@mendable/firecrawl-js";
import { createClient } from "@/lib/supabase/server";
import { ensureWorkspaceContext } from "@/lib/app/bootstrap";
import { KNOWLEDGE_BUCKET, SUPPORTED_KNOWLEDGE_MIME_TYPES } from "@/lib/knowledge";
import type { KnowledgeSourceRecord, KnowledgeSourceType } from "@/lib/types";

const SUPPORTED_MIME_SET = new Set<string>(SUPPORTED_KNOWLEDGE_MIME_TYPES);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

function inferMimeType(fileName: string, mimeType: string) {
  if (mimeType) {
    return mimeType;
  }

  const lower = fileName.toLowerCase();

  if (lower.endsWith(".md")) {
    return "text/markdown";
  }

  if (lower.endsWith(".txt")) {
    return "text/plain";
  }

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  return "";
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
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("workspace_id", context.workspace.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sources: (data ?? []) as KnowledgeSourceRecord[],
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await ensureWorkspaceContext(supabase as never, user);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const sourceType = String(body.sourceType ?? "").trim() as KnowledgeSourceType;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  if (!["text", "file", "website"].includes(sourceType)) {
    return NextResponse.json({ error: "sourceType must be text, file, or website." }, { status: 400 });
  }

  if (sourceType === "text") {
    const rawText = String(body.rawText ?? "").trim();

    if (!rawText) {
      return NextResponse.json({ error: "rawText is required for text sources." }, { status: 400 });
    }

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name,
        description,
        source_type: "text",
        raw_text: rawText,
        status: "pending",
      })
      .select()
      .single();

    if (error || !source) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create knowledge source." },
        { status: 500 },
      );
    }

    const processResponse = await supabase.functions.invoke("process-knowledge-source", {
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
      body: {
        sourceId: source.id,
      },
    });

    if (processResponse.error) {
      return NextResponse.json(
        {
          error: processResponse.error.message,
          source,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      source,
      processStatus: "processing",
    });
  }

  if (sourceType === "website") {
    const url = String(body.url ?? "").trim();

    if (!url) {
      return NextResponse.json({ error: "url is required for website sources." }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL provided." }, { status: 400 });
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      return NextResponse.json({ error: "FIRECRAWL_API_KEY is not configured." }, { status: 500 });
    }

    const firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });
    let rawText = "";

    try {
      const scrapeResult = await firecrawl.scrape(url, { formats: ["markdown"] });
      if (!scrapeResult.markdown) {
        throw new Error("Failed to extract markdown from website.");
      }
      rawText = scrapeResult.markdown;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to scrape website." },
        { status: 500 }
      );
    }

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        workspace_id: context.workspace.id,
        created_by: user.id,
        name,
        description,
        source_type: "website",
        raw_text: rawText,
        status: "pending",
        metadata: { sourceUrl: url },
      })
      .select()
      .single();

    if (error || !source) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create knowledge source." },
        { status: 500 },
      );
    }

    const processResponse = await supabase.functions.invoke("process-knowledge-source", {
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
      body: {
        sourceId: source.id,
      },
    });

    if (processResponse.error) {
      return NextResponse.json(
        {
          error: processResponse.error.message,
          source,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      source,
      processStatus: "processing",
    });
  }

  const fileName = String(body.fileName ?? "").trim();
  const mimeType = inferMimeType(fileName, String(body.mimeType ?? "").trim());
  const fileSizeBytes = Number(body.fileSizeBytes ?? 0);

  if (!fileName || !mimeType || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return NextResponse.json(
      { error: "fileName, mimeType, and fileSizeBytes are required for file sources." },
      { status: 400 },
    );
  }

  if (!SUPPORTED_MIME_SET.has(mimeType)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }

  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .insert({
      workspace_id: context.workspace.id,
      created_by: user.id,
      name,
      description,
      source_type: "file",
      status: "pending",
      storage_bucket: KNOWLEDGE_BUCKET,
      storage_path: "",
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
    })
    .select()
    .single();

  if (error || !source) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create knowledge source." },
      { status: 500 },
    );
  }

  const storagePath = `${context.workspace.id}/${source.id}/${sanitizeFileName(fileName)}`;
  const { data: updatedSource, error: updateError } = await supabase
    .from("knowledge_sources")
    .update({
      storage_path: storagePath,
    })
    .eq("id", source.id)
    .select()
    .single();

  if (updateError || !updatedSource) {
    return NextResponse.json(
      { error: updateError?.message ?? "Failed to reserve upload path." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    source: updatedSource,
    upload: {
      bucket: KNOWLEDGE_BUCKET,
      path: storagePath,
    },
  });
}
