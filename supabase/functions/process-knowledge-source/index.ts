import { createClient } from "npm:@supabase/supabase-js@2";
import Firecrawl from "npm:@mendable/firecrawl-js@4.32.0";
import { json } from "../_shared/http.ts";
import { beforeDeadline, generateRemoteEmbedding, ProcessingError } from "../_shared/processing.ts";
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

const DEFAULT_KNOWLEDGE_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const MAX_WEBSITE_KNOWLEDGE_PAGES = 30;

/**
 * Plans that may crawl more than one page.
 *
 * Mirrors hasPremiumCapabilities() in src/lib/plan-limits.ts. This function
 * runs in Deno and cannot import from the Next.js app, so the rule is repeated
 * deliberately — and it has to be, because this check is what actually holds:
 * the route's decision arrives as source metadata, which this function is right
 * not to trust. Change both together.
 */
function planMayCrawlWholeSite(planTier: string | null | undefined) {
  return planTier === "premium" || planTier === "trial";
}

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
  chunk_count: number;
  processing_token: string | null;
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
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const deadline = AbortSignal.timeout(110_000);
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

  if (source.status === "ready") {
    return json({ ok: true, sourceId, status: "ready", chunkCount: source.chunk_count });
  }

  const processingToken = crypto.randomUUID();
  const claim = await adminClient.rpc("claim_knowledge_processing", {
    p_source_id: sourceId, p_token: processingToken,
  });
  if (claim.error) {
    console.error("[Process] Claim failed", claim.error);
    return json({ error: "Could not acquire the processing lock.", code: "PROCESSING_CLAIM_FAILED" }, 503);
  }
  if (!claim.data) return json({ ok: true, sourceId, status: "processing" }, 202);

  // Reload after claiming: an edit may have completed between authorization and claim.
  const current = await adminClient.from("knowledge_sources").select("*")
    .eq("id", sourceId).eq("processing_token", processingToken).single();
  if (current.error || !current.data) {
    return json({ error: "Could not load the claimed source. Retry in three minutes.", code: "PROCESSING_LOAD_FAILED" }, 503);
  }
  source = current.data as KnowledgeSourceRow;

  try {
    let finalRawText = source.raw_text as string | null;

    // Phase 1: Ingestion
    if (source.source_type === "website" && (!finalRawText || finalRawText.trim() === "")) {
      console.log(`[Process] Ingesting website source...`);
      if (!firecrawlApiKey) {
        throw new Error("FIRECRAWL_API_KEY is not configured in Supabase secrets.");
      }

      const firecrawl = new Firecrawl({
        apiKey: firecrawlApiKey, timeoutMs: 35_000, maxRetries: 2,
      });
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

      const canCrawlWholeSite = planMayCrawlWholeSite(
        subscriptionResult.data?.plan_tier,
      );
      const crawlLimit = canCrawlWholeSite
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

      if (!canCrawlWholeSite && selectedUrls.length > 0) {
        throw new Error(
          "Selecting multiple website pages requires a Premium or trial plan.",
        );
      }

      let scrapedText = "";

      if (selectedUrls.length > 0) {
        console.log(`[Process] Scraping ${selectedUrls.length} selected URLs in batches...`);
        const validResults: string[] = [];
        const failedUrls: string[] = [];
        const batchSize = 4;

        for (let index = 0; index < selectedUrls.length; index += batchSize) {
          deadline.throwIfAborted();
          const batch = selectedUrls.slice(index, index + batchSize);
          const scrapePromises: Array<Promise<string | null>> = batch.map(async (u: string) => {
            console.log(`[Process] Scraping individual URL: ${u}`);
            try {
              const res = await beforeDeadline(firecrawl.scrape(u, { formats: ["markdown"], timeout: 25_000, skipTlsVerification: false }), deadline);
              if (res.markdown?.trim() && (!res.metadata?.statusCode || res.metadata.statusCode < 400)) {
                console.log(`[Process] Successfully scraped ${u} (${res.markdown.length} chars)`);
                return res.markdown;
              } else {
                console.warn(`[Process] No readable markdown returned for ${u}`);
                failedUrls.push(u);
                return null;
              }
            } catch (err) {
              console.error(`[Process] Scrape error for ${u}:`, err);
              failedUrls.push(u);
              return null;
            }
          });

          const results = await Promise.all(scrapePromises);
          validResults.push(...results.filter((result: string | null): result is string => result !== null));
          console.log(`[Process] Finished selected URL batch ${Math.floor(index / batchSize) + 1}/${Math.ceil(selectedUrls.length / batchSize)}.`);
        }

        if (failedUrls.length) {
          throw new ProcessingError(
            `Could not scrape ${failedUrls.length} of ${selectedUrls.length} selected pages: ${failedUrls.join(", ")}. Check the pages and retry.`,
            "WEBSITE_PAGES_FAILED", 422,
          );
        }
        scrapedText = validResults.join("\n\n---\n\n");

      } else if (crawlLimit > 1 && canCrawlWholeSite) {
        console.log(`[Process] Crawling website: ${targetUrl.toString()} (Limit: ${crawlLimit})`);
        // firecrawl.crawl() polls until done and returns a CrawlJob ({ status, data[], total, completed })
        const crawlResult = await beforeDeadline(firecrawl.crawl(targetUrl.toString(), {
          limit: crawlLimit,
          timeout: 60,
          scrapeOptions: { formats: ["markdown"], timeout: 25_000, skipTlsVerification: false },
        }), deadline);

        // CrawlJob.status is 'completed' | 'failed' | 'cancelled' | 'scraping'
        if (crawlResult.status !== "completed") {
          console.error(`[Process] Crawl failed with status: ${crawlResult.status}`, crawlResult);
          throw new Error(`Website crawl ended with status: ${crawlResult.status}`);
        }

        const pages = Array.isArray(crawlResult.data) ? crawlResult.data : [];
        if (pages.some((page: { markdown?: string; metadata?: { statusCode?: number } }) =>
          !page.markdown?.trim() || (page.metadata?.statusCode ?? 200) >= 400)) {
          throw new ProcessingError("Some crawled pages did not return readable content. Select specific pages and retry.", "WEBSITE_PAGES_FAILED", 422);
        }
        scrapedText = pages
          .map((page: { markdown?: string }) => page.markdown)
          .filter(Boolean)
          .join("\n\n---\n\n");
        console.log(`[Process] Crawl finished. Status: ${crawlResult.status}, pages: ${pages.length}/${crawlResult.total ?? '?'}.`);
      } else {
        console.log(`[Process] Scraping single page: ${targetUrl.toString()}`);
        const scrapeResult = await beforeDeadline(firecrawl.scrape(targetUrl.toString(), { formats: ["markdown"], timeout: 25_000, skipTlsVerification: false }), deadline);
        if (!scrapeResult.markdown?.trim() || (scrapeResult.metadata?.statusCode ?? 200) >= 400) {
          console.error(`[Process] Single scrape failed:`, scrapeResult);
          throw new Error(`Failed to extract markdown from ${targetUrl.toString()}.`);
        }
        scrapedText = scrapeResult.markdown;
        console.log(`[Process] Single scrape successful (${scrapedText.length} chars)`);
      }

      if (!scrapedText || scrapedText.trim().length === 0) {
        throw new Error(`No readable content could be extracted from the website. Check if the URL is accessible.`);
      }

      deadline.throwIfAborted();
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
        .eq("id", source.id).eq("processing_token", processingToken);

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

    const revisionBytes = await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(`gte-small:v2:${normalizedText}`),
    );
    const revision = Array.from(new Uint8Array(revisionBytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const completed = new Set<number>();
    // Paginate checkpoints instead of silently truncating sources at PostgREST's row limit.
    for (let offset = 0; ; offset += 500) {
      const saved = await adminClient.from("knowledge_chunks").select("chunk_index")
        .eq("source_id", source.id).eq("metadata->>ingestionRevision", revision)
        .not("embedding", "is", null).order("chunk_index").range(offset, offset + 499);
      if (saved.error) throw saved.error;
      for (const row of saved.data ?? []) completed.add(row.chunk_index);
      if ((saved.data?.length ?? 0) < 500) break;
    }
    const pending = chunks.filter((chunk) => !completed.has(chunk.chunkIndex));
    console.log(`[Process] Embedding ${pending.length}/${chunks.length} chunks; ${completed.size} already saved.`);
    for (let index = 0; index < pending.length; index += 2) {
      deadline.throwIfAborted();
      // Remote inference, with at most two in flight. Each worker performs ONE inference.
      const rows = await Promise.all(pending.slice(index, index + 2).map(async (chunk) => ({
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: await generateRemoteEmbedding(chunk.content, {
          url: supabaseUrl, key: supabaseAdminKey, signal: deadline,
        }),
      })));
      const checkpoint = await adminClient.rpc("checkpoint_knowledge_processing", {
        p_source_id: source.id, p_token: processingToken, p_revision: revision,
        p_chunks: rows, p_total_chunks: chunks.length,
      });
      if (checkpoint.error) throw checkpoint.error;
      console.log(`[Process] Saved ${Math.min(index + 2, pending.length) + completed.size}/${chunks.length} embeddings.`);
    }
    const finalized = await adminClient.rpc("checkpoint_knowledge_processing", {
      p_source_id: source.id, p_token: processingToken, p_revision: revision,
      p_chunks: [], p_total_chunks: chunks.length, p_complete: true,
    });
    if (finalized.error) throw finalized.error;
    console.log(`[Process] Job completed successfully for source: ${sourceId}`);
    return json({ ok: true, sourceId: source.id, status: "ready", chunkCount: chunks.length });

  } catch (error) {
    console.error(`[Process] CRITICAL ERROR for source ${sourceId}:`, error);
    
    const message = deadline.aborted
      ? "Processing reached its time limit. Progress is saved; retry to continue."
      : error instanceof ProcessingError ? error.message
      : error instanceof Error && (error.message.startsWith("FIRECRAWL_API_KEY") || error.message.startsWith("Storage limit exceeded"))
        ? error.message
        : "Knowledge processing failed. Saved progress can be retried.";
    const failure = await adminClient
      .from("knowledge_sources")
      .update({ status: "failed", error_message: message, processing_token: null, processing_expires_at: null })
      .eq("id", sourceId).eq("processing_token", processingToken);
    if (failure.error) console.error("[Process] Could not save failure state", failure.error);
    return json({ error: message, code: deadline.aborted ? "PROCESSING_TIMEOUT"
      : error instanceof ProcessingError ? error.code : "KNOWLEDGE_PROCESSING_FAILED" },
      error instanceof ProcessingError && error.status < 500 ? error.status : 503);
  }
});
