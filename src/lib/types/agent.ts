import type { AgentStatus, AgentSurface } from "./enums";
import type { BuilderDefinition } from "./builder";

export interface AgentRecord {
  id: string;
  workspace_id: string;
  created_by: string;
  surface: AgentSurface;
  name: string;
  slug: string;
  description: string;
  status: AgentStatus;
  model: string;
  instructions: string;
  starter_prompts: string[];
  timezone: string;
  published_version_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentVersionRecord {
  id: string;
  agent_id: string;
  workspace_id: string;
  version: number;
  definition: BuilderDefinition;
  published_by: string;
  created_at: string;
}