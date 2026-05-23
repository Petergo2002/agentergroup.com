import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  normalizeKnowledgeFolderSourceIds,
  toKnowledgeFolderWithSources,
} from "../../src/lib/knowledge-folders.ts";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260520132303_knowledge_folders.sql"),
  "utf8",
);

test("knowledge folder helpers dedupe source ids and expose source membership", () => {
  assert.deepEqual(
    normalizeKnowledgeFolderSourceIds([" source-a ", "source-a", "", null, "source-b"]),
    ["source-a", "source-b"],
  );

  assert.deepEqual(
    toKnowledgeFolderWithSources({
      id: "folder-a",
      workspace_id: "workspace-a",
      created_by: "user-a",
      name: "Sales",
      description: "",
      created_at: "2026-05-20T00:00:00.000Z",
      updated_at: "2026-05-20T00:00:00.000Z",
      sources: [
        { knowledge_source_id: "source-a" },
        { knowledge_source_id: "source-b" },
      ],
    }).sourceIds,
    ["source-a", "source-b"],
  );
});

test("knowledge folder migration scopes folder tables with RLS and workspace checks", () => {
  assert.match(migration, /create table if not exists public\.knowledge_folders/);
  assert.match(migration, /create table if not exists public\.knowledge_folder_sources/);
  assert.match(migration, /create table if not exists public\.agent_knowledge_folders/);
  assert.match(migration, /alter table public\.knowledge_folders enable row level security/);
  assert.match(migration, /alter table public\.knowledge_folder_sources enable row level security/);
  assert.match(migration, /alter table public\.agent_knowledge_folders enable row level security/);
  assert.match(migration, /private\.is_workspace_member/);
  assert.doesNotMatch(migration, /public\.is_workspace_member/);
  assert.match(migration, /folders\.workspace_id = sources\.workspace_id/);
  assert.match(migration, /agents\.workspace_id = folders\.workspace_id/);
});

test("knowledge search RPC includes direct and folder-attached ready sources", () => {
  assert.match(migration, /from public\.agent_knowledge_sources aks/);
  assert.match(migration, /from public\.agent_knowledge_folders akf/);
  assert.match(migration, /join public\.knowledge_folder_sources kfs/);
  assert.match(migration, /ks\.status = 'ready'/);
});
