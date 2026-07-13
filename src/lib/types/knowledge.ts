import type { KnowledgeSourceType, KnowledgeSourceStatus } from "./enums";

export interface KnowledgeSourceRecord {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string;
  source_type: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  raw_text: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  chunk_count: number;
  last_processed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunkRecord {
  id: string;
  source_id: string;
  workspace_id: string;
  chunk_index: number;
  content: string;
  content_length: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentKnowledgeSourceRecord {
  id: string;
  agent_id: string;
  knowledge_source_id: string;
  created_at: string;
}

export interface KnowledgeFolderRecord {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeFolderSourceRecord {
  id: string;
  folder_id: string;
  knowledge_source_id: string;
  created_at: string;
}

export interface AgentKnowledgeFolderRecord {
  id: string;
  agent_id: string;
  knowledge_folder_id: string;
  created_at: string;
}

export interface KnowledgeFolderWithSources extends KnowledgeFolderRecord {
  sourceIds: string[];
}

export interface DriveImportFileRecord {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  size: string | null;
}

export interface KnowledgeMatchRecord {
  chunk_id: string;
  source_id: string;
  source_name: string;
  content: string;
  similarity: number;
  chunk_index: number;
  metadata: Record<string, unknown>;
}
