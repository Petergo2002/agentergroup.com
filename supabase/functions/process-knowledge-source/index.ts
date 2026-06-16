import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-expect-error -- npm: specifier is resolved by the Deno runtime, not the TS compiler
import Firecrawl from "npm:@mendable/firecrawl-js";
import { buildClientSafeError, json } from "../_shared/http.ts";
import { chunkKnowledgeText, extractTextFromFile, normalizeKnowledgeText } from "../_shared/knowledge.ts";

function readFirstSupabaseSecretKey() {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!secretKeysJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;

    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        const keyValue = record.key ?? record.value ?? record.secret ?? record.api_key;

        if (typeof keyValue === "string" && keyValue.trim()) {
          return keyValue.trim();
        }
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabasePublishableKey =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseAdminKey =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  readFirstSupabaseSecretKey()!;
const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
const model = new Supabase.ai.Session("gte-small");
const DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const MAX_WEBSITE_KNOWLEDGE_PAGES = 30;

interface KnowledgeSourceRow {
  id: string;
  workspace_id: string;
  name: string;
  source_type: string;
  status: string;
  raw_text: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
}

function buildStorageLimitError(storageLimitBytes: number) {
  return `Storage limit exceeded. Your current plan allows ${
    storageLimitBytes / 1024 / 1024
  }MB total knowledge base storage.`;
}

function normalizeWebsiteUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : `https://${value.trim()}`;
  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Website URL must use HTTP or HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Website URL cannot include credentials.");
  }

  url.hash = "";
  return url;
}

function normalizeSelectedUrls(baseUrl: URL, values: unknown) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  const selectedUrls: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const candidate = normalizeWebsiteUrl(value);
    if (candidate.origin !== baseUrl.origin) {
      throw new Error("Selected URLs must belong to the website origin.");
    }

    const normalized = candidate.toString();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      selectedUrls.push(normalized);
    }

    if (selectedUrls.length > MAX_WEBSITE_KNOWLEDGE_PAGES) {
      throw new Error(
        `A maximum of ${MAX_WEBSITE_KNOWLEDGE_PAGES} website pages can be processed at once.`,
      );
    }
  }

  return selectedUrls;
}

function extractBearerToken(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || value.trim();
}

function getConfiguredSecretKeys() {
  const keys = [
    Deno.env.get("SUPABASE_SECRET_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseAdminKey,
  ];
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysJson) {
    try {
      const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;

      for (const value of Object.values(parsed)) {
        if (typeof value === "string") {
          keys.push(value);
          continue;
        }

        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          const keyValue = record.key ?? record.value ?? record.secret ?? record.api_key;

          if (typeof keyValue === "string") {
            keys.push(keyValue);
          }
        }
      }
    } catch {
      // Ignore malformed platform metadata and rely on explicit secrets.
    }
  }

  return new Set(keys.map((key) => key?.trim()).filter(Boolean) as string[]);
}

Deno.serve(async (request) => {
  const adminClient = createClient(supabaseUrl, supabaseAdminKey);
  const body = await request.json().catch(() => ({}));
  const sourceId = String(body.sourceId ?? "").trim();

  if (!sourceId) {
    return json({ error: "sourceId is required." }, 400);
  }

  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("apikey");
  const internalServiceKey = request.headers.get("x-internal-service-key");
  const configuredSecretKeys = getConfiguredSecretKeys();
  const requestKeys = [
    internalServiceKey,
    apiKeyHeader,
    extractBearerToken(authHeader),
    authHeader,
  ].map((value) => value?.trim()).filter(Boolean) as string[];
  const isInternalRequest = requestKeys.some((key) => configuredSecretKeys.has(key));
  console.log(`[Process] Starting job for source: ${sourceId}`);

  let source: KnowledgeSourceRow | null = null;

  if (isInternalRequest) {
    const sourceResult = await adminClient
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle();

    if (sourceResult.error) {
      console.error(`[Process] Failed to load source ${sourceId}:`, sourceResult.error);
      return json({ error: "Knowledge source could not be loaded." }, 500);
    }

    source = sourceResult.data as KnowledgeSourceRow | null;
  } else if (authHeader) {
    const userClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("[Process] Unauthorized access attempt:", userError);
      return json({ error: "Unauthorized" }, 401);
    }

    const sourceResult = await userClient
      .from("knowledge_sources")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle();

    if (sourceResult.error) {
      console.error(`[Process] User-scoped source lookup failed for ${sourceId}:`, sourceResult.error);
      return json({ error: "Knowledge source could not be loaded." }, 500);
    }

    source = sourceResult.data as KnowledgeSourceRow | null;
  } else {
    console.error("[Process] Missing Authorization header");
    return json({ error: "Missing Authorization header." }, 401);
  }

  if (!source) {
    return json({ error: "Knowledge source not found." }, 404);
  }

  await adminClient
    .from("knowledge_sources")
    .update({ status: "processing", error_message: null })
    .eq("id", sourceId);

  try {
    let finalRawText = source.raw_text as string | null;

    // Phase 1: Ingestion
    if (source.source_type === "website" && (!finalRawText || finalRawText.trim() === "")) {
      console.log(`[Process] Ingesting website source...`);
      if (!firecrawlApiKey) {
        throw new Error("FIRECRAWL_API_KEY is not configured in Supabase secrets.");
      }

      const firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });
      const metadata = source.metadata || {};
      const rawUrl = typeof metadata.sourceUrl === "string"
        ? metadata.sourceUrl
        : "";

      if (!rawUrl) throw new Error("Missing sourceUrl in website metadata.");

      const targetUrl = normalizeWebsiteUrl(rawUrl);
      const selectedUrls = normalizeSelectedUrls(targetUrl, metadata.selectedUrls);
      const requestedCrawlLimit = Number(metadata.crawlLimit ?? 1);
      const subscriptionResult = await adminClient
        .from("workspace_subscriptions")
        .select("plan_tier, storage_limit_bytes")
        .eq("workspace_id", source.workspace_id)
        .maybeSingle();

      if (subscriptionResult.error) {
        throw new Error(`Failed to load workspace subscription: ${subscriptionResult.error.message}`);
      }

      const isPremium = subscriptionResult.data?.plan_tier === "premium";
      const crawlLimit = isPremium
        ? Math.min(
            Math.max(
              Number.isFinite(requestedCrawlLimit)
                ? Math.floor(requestedCrawlLimit)
                : 1,
              1,
            ),
            MAX_WEBSITE_KNOWLEDGE_PAGES,
          )
        : 1;

      if (!isPremium && selectedUrls.length > 0) {
        throw new Error("Selecting multiple website pages requires a Premium plan.");
      }

      let scrapedText = "";

      if (selectedUrls.length > 0) {
        console.log(`[Process] Scraping ${selectedUrls.length} selected URLs in batches...`);
        const validResults: string[] = [];
        const batchSize = 4;

        for (let index = 0; index < selectedUrls.length; index += batchSize) {
          const batch = selectedUrls.slice(index, index + batchSize);
          const scrapePromises: Array<Promise<string | null>> = batch.map(async (u: string) => {
            console.log(`[Process] Scraping individual URL: ${u}`);
            try {
              const res = await firecrawl.scrape(u, { formats: ["markdown"] });
              if (res.markdown) {
                console.log(`[Process] Successfully scraped ${u} (${res.markdown.length} chars)`);
                return res.markdown;
              } else {
                console.warn(`[Process] No markdown returned for ${u}`);
                return null;
              }
            } catch (err) {
              console.error(`[Process] Scrape error for ${u}:`, err);
              return null;
            }
          });

          const results = await Promise.all(scrapePromises);
          validResults.push(...results.filter((result: string | null): result is string => result !== null));
          console.log(`[Process] Finished selected URL batch ${Math.floor(index / batchSize) + 1}/${Math.ceil(selectedUrls.length / batchSize)}.`);
        }

        scrapedText = validResults.join("\n\n---\n\n");

      } else if (crawlLimit > 1 && isPremium) {
        console.log(`[Process] Crawling website: ${targetUrl.toString()} (Limit: ${crawlLimit})`);
        // firecrawl.crawl() polls until done and returns a CrawlJob ({ status, data[], total, completed })
        const crawlResult = await firecrawl.crawl(targetUrl.toString(), {
          limit: crawlLimit,
          scrapeOptions: { formats: ["markdown"] },
        });

        // CrawlJob.status is 'completed' | 'failed' | 'cancelled' | 'scraping'
        if (crawlResult.status === "failed" || crawlResult.status === "cancelled") {
          console.error(`[Process] Crawl failed with status: ${crawlResult.status}`, crawlResult);
          throw new Error(`Website crawl ended with status: ${crawlResult.status}`);
        }

        const pages = Array.isArray(crawlResult.data) ? crawlResult.data : [];
        scrapedText = pages
          .map((page: { markdown?: string }) => page.markdown)
          .filter(Boolean)
          .join("\n\n---\n\n");
        console.log(`[Process] Crawl finished. Status: ${crawlResult.status}, pages: ${pages.length}/${crawlResult.total ?? '?'}.`);
      } else {
        console.log(`[Process] Scraping single page: ${targetUrl.toString()}`);
        const scrapeResult = await firecrawl.scrape(targetUrl.toString(), { formats: ["markdown"] });
        if (!scrapeResult.markdown) {
          console.error(`[Process] Single scrape failed:`, scrapeResult);
          throw new Error(`Failed to extract markdown from ${targetUrl.toString()}.`);
        }
        scrapedText = scrapeResult.markdown;
        console.log(`[Process] Single scrape successful (${scrapedText.length} chars)`);
      }

      if (!scrapedText || scrapedText.trim().length === 0) {
        throw new Error(`No readable content could be extracted from the website. Check if the URL is accessible.`);
      }

      const newSizeBytes = new TextEncoder().encode(scrapedText).length;
      const storageLimitBytes =
        subscriptionResult.data?.storage_limit_bytes ??
        DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES;

      const reservationResult = await adminClient.rpc(
        "reserve_knowledge_source_storage",
        {
          p_workspace_id: source.workspace_id,
          p_source_id: source.id,
          p_size_bytes: newSizeBytes,
        },
      );

      if (reservationResult.error) {
        if (
          reservationResult.error.message.includes(
            "KNOWLEDGE_STORAGE_LIMIT_EXCEEDED",
          )
        ) {
          throw new Error(buildStorageLimitError(storageLimitBytes));
        }

        throw new Error(
          `Failed to reserve knowledge storage: ${reservationResult.error.message}`,
        );
      }

      if (newSizeBytes > storageLimitBytes) {
        throw new Error(buildStorageLimitError(storageLimitBytes));
      }

      console.log(`[Process] Saving extracted text to DB (${newSizeBytes} bytes)...`);
      
      const { error: updateError } = await adminClient
        .from("knowledge_sources")
        .update({
          raw_text: scrapedText,
        })
        .eq("id", source.id);

      if (updateError) throw new Error(`DB Update Error: ${updateError.message}`);
      finalRawText = scrapedText;
    } else if (source.source_type === "file") {
      console.log(`[Process] Processing file source...`);
      if (!source.storage_bucket || !source.storage_path || !source.mime_type) {
        throw new Error("File source is missing storage metadata.");
      }

      const download = await adminClient.storage
        .from(source.storage_bucket)
        .download(source.storage_path);

      if (download.error || !download.data) {
        throw download.error ?? new Error("Failed to download file content.");
      }

      const bytes = new Uint8Array(await download.data.arrayBuffer());
      finalRawText = await extractTextFromFile(bytes, source.mime_type);
      console.log(`[Process] File text extracted (${finalRawText?.length ?? 0} chars)`);
    }

    // Phase 2: Processing
    console.log(`[Process] Normalizing and chunking text...`);
    const normalizedText = normalizeKnowledgeText(finalRawText ?? "");
    const chunks = chunkKnowledgeText(normalizedText);

    if (chunks.length === 0) {
      console.error(`[Process] Zero chunks generated. Text length: ${finalRawText?.length ?? 0}`);
      throw new Error("No readable text was found in this source after normalization.");
    }

    console.log(`[Process] Generating embeddings for ${chunks.length} chunks...`);
    const chunkRows: Array<Record<string, unknown>> = [];
    const embeddingBatchSize = 8;

    for (let index = 0; index < chunks.length; index += embeddingBatchSize) {
      const batch = chunks.slice(index, index + embeddingBatchSize);
      const rows = await Promise.all(
        batch.map(async (chunk) => {
          try {
            const embedding = await model.run(chunk.content, {
              mean_pool: true,
              normalize: true,
            });

            return {
              source_id: source.id,
              workspace_id: source.workspace_id,
              chunk_index: chunk.chunkIndex,
              content: chunk.content,
              content_length: chunk.contentLength,
              embedding: JSON.stringify(embedding),
              metadata: {
                sourceType: source.source_type,
                sourceName: source.name,
                chunkIndex: chunk.chunkIndex,
                contentLength: chunk.contentLength,
                ingestionVersion: 1,
              },
            };
          } catch (embErr) {
            console.error(`[Process] Embedding error for chunk ${chunk.chunkIndex}:`, embErr);
            throw embErr;
          }
        }),
      );

      chunkRows.push(...rows);
      console.log(
        `[Process] Finished embedding batch ${Math.floor(index / embeddingBatchSize) + 1}/${Math.ceil(chunks.length / embeddingBatchSize)}.`,
      );
    }

    chunkRows.sort((a, b) => Number(a.chunk_index) - Number(b.chunk_index));

    console.log(`[Process] Deleting old chunks...`);
    await adminClient.from("knowledge_chunks").delete().eq("source_id", source.id);

    console.log(`[Process] Inserting ${chunkRows.length} new chunks...`);
    const insertResult = await adminClient.from("knowledge_chunks").insert(chunkRows);
    if (insertResult.error) throw insertResult.error;

    // Phase 3: Finalize
    console.log(`[Process] Finalizing source status...`);
    const updateResult = await adminClient
      .from("knowledge_sources")
      .update({
        status: "ready",
        chunk_count: chunkRows.length,
        last_processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", source.id);

    if (updateResult.error) throw updateResult.error;

    console.log(`[Process] Job completed successfully for source: ${sourceId}`);
    return json({ ok: true, sourceId: source.id, chunkCount: chunkRows.length });

  } catch (error) {
    console.error(`[Process] CRITICAL ERROR for source ${sourceId}:`, error);
    
    await adminClient
      .from("knowledge_sources")
      .update({
        status: "failed",
        chunk_count: 0,
        error_message: error instanceof Error ? error.message : "Knowledge processing failed.",
      })
      .eq("id", sourceId);

    const safeError = buildClientSafeError("process-knowledge-source", error, "Knowledge processing failed.");
    return json(safeError, 500);
  }
});
