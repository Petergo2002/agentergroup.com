export interface DebugEvent {
  type:
    | "tool_call"
    | "tool_result"
    | "tool_error"
    | "tool_empty_result"
    | "session_miss"
    | "session_created"
    | "recovery_triggered"
    | "llm_error"
    | "knowledge_hit";
  ts: number;
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  iterationIndex?: number;
}

export interface DebugTrace {
  durationMs: number;
  iterationsUsed: number;
  toolsAvailable: string[];
  knowledgeHits: number;
  events: DebugEvent[];
  hadError: boolean;
  errorSummary?: string;
}