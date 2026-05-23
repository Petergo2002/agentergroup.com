import type { AgentSurface, KnowledgeSourceType } from "./enums";
import type { BuilderDefinition } from "./builder";

export type AgentLibraryTemplateStatus = "pending" | "approved" | "rejected";

/** A single dynamic variable extracted from a prompt template, e.g. {{company_name}} */
export interface TemplateVariable {
  key: string;
  label: string;
  description?: string;
}

export interface AgentLibraryTemplateRecord {
  id: string;
  source_agent_id: string | null;
  source_workspace_id: string;
  submitted_by: string;
  reviewed_by: string | null;
  status: AgentLibraryTemplateStatus;
  name: string;
  slug: string;
  description: string;
  surface: AgentSurface;
  model: string;
  instructions: string;
  starter_prompts: string[];
  timezone: string;
  definition: BuilderDefinition;
  required_integrations: string[];
  knowledge_source_count: number;
  template_variables: TemplateVariable[];
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLibraryTemplateSourceRecord {
  id: string;
  template_id: string;
  original_source_id: string | null;
  original_source_type: KnowledgeSourceType;
  source_name: string;
  source_description: string;
  content_text: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentLibraryTemplateWithSources
  extends AgentLibraryTemplateRecord {
  sources: AgentLibraryTemplateSourceRecord[];
}
