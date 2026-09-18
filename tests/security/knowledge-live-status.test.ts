import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  "src/app/(app)/knowledge/KnowledgePageClient.tsx",
  "utf8",
);
const table = readFileSync("src/components/knowledge/SourceTable.tsx", "utf8");

test("the list refreshes itself while a source is still ingesting", () => {
  // Ingestion takes tens of seconds. Without this the page showed "Pending"
  // until the customer reloaded by hand to discover it had long since finished.
  assert.match(page, /setInterval\(refresh, KNOWLEDGE_POLL_INTERVAL_MS\)/);
  assert.match(page, /const KNOWLEDGE_POLL_INTERVAL_MS = 3_000;/);
});

test("polling stops once nothing is in flight", () => {
  // A permanent timer on a settled list is wasted load on every open tab.
  assert.match(page, /if \(!hasWorkInProgress\) \{\s*\n\s*return;/);
  assert.match(
    page,
    /source\.status === "pending" \|\| source\.status === "processing"/,
  );
});

test("a hidden tab does not poll, but catches up when looked at", () => {
  assert.match(page, /document\.visibilityState === "hidden"/);
  assert.match(page, /addEventListener\("visibilitychange", refresh\)/);
  assert.match(page, /removeEventListener\("visibilitychange", refresh\)/);
});

test("the Syncing tile counts pending sources too", () => {
  // A paused source is still working. Counting only "processing" left it in
  // Total but in none of Ready, Syncing or Failed — invisible in the summary.
  const syncing = page.slice(
    page.indexOf("processing: sources.filter("),
    page.indexOf("failed: sources.filter("),
  );
  assert.match(syncing, /status === "processing" \|\| source\.status === "pending"/);
});

test("pending reads as working, not idle", () => {
  // It renders with the same active treatment as processing; neutral grey read
  // as stuck, which is the opposite of what pending now means.
  assert.match(table, /status === "processing" \|\| status === "pending"/);
  assert.match(table, /Loader2 className="h-3\.5 w-3\.5 animate-spin text-primary"/);
});

test("progress is shown while it advances, and not once it is done", () => {
  // processingProgress is written by every checkpoint, so it moves live.
  assert.match(table, /processingProgress/);
  assert.match(table, /rawProgress\.completed < rawProgress\.total/);
  assert.match(table, /\{progress\.completed\}\/\{progress\.total\}/);
});
