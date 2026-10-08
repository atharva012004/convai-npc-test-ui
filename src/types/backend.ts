export type DynamicContextStatus = 'complete' | 'partial' | 'empty' | 'failed' | 'cancelled';

export interface DynamicContextItem {
  item_id: string;
  source: 'memory' | 'narrative' | 'knowledge';
  content: string;
  relevance: number | null;
  confidence: number | null;
  freshness: number | null;
  importance: number | null;
  priority: number;
  authority: number | null;
  token_count: number;
  score: number;
  provenance?: Record<string, unknown>;
}

export interface DynamicContext {
  status: DynamicContextStatus;
  memory: DynamicContextItem[];
  narrative: DynamicContextItem[];
  knowledge: DynamicContextItem[];
  policy_version: string | null;
  selected_count: number;
  dropped_count: number;
  conflict_groups: Record<string, unknown>[];
  budget_usage: Record<string, number>;
  metadata: Record<string, unknown>;
  text: string;
}

export interface SessionStartResponse {
  id: string;
  character_id: string;
  actor_id: string;
  status: string;
  started_at: string;
  context: {
    project: { id: string; name: string };
    character: {
      id: string;
      external_id: string;
      convai_character_id: string | null;
      base_personality: string | null;
      config: Record<string, unknown>;
    };
    actor: { id: string; external_id: string; meta: Record<string, unknown> };
    relationship: Record<string, unknown> | null;
    session: {
      id: string;
      status: string;
      started_at: string;
      ended_at: string | null;
    };
    narrative: Record<string, unknown> | null;
    knowledge: Record<string, unknown> | null;
    memory: { memories: DynamicContextItem[]; strategy_name: string; total_candidates: number } | null;
    dynamic_context: DynamicContext | null;
  };
}

export interface BootstrapResponse {
  access_token: string;
  token_type: 'Bearer' | string;
  expires_at: number;
  project_id: string;
  character_external_id: string;
  actor_external_id: string;
  client_id: string;
}


export interface ConversationRuntimeDiagnostics {
  context_status: string;
  context_fingerprint: string | null;
  memory_count: number;
  narrative_count: number;
  knowledge_count: number;
  selected_count: number;
  dropped_count: number;
  context_tokens: number;
  knowledge_retrieval_used: boolean;
  dynamic_context_text: string;
}

export interface ConvaiTokenResponse {
  api_auth_token: string;
  expiration_time: string;
  convai_character_id: string;
  end_user_id: string;
  binding: {
    character_external_id: string;
    convai_character_id: string;
    actor_external_id: string;
    end_user_id: string;
  };
}

export type SessionEndResponse = boolean;

export interface TranscriptTurn {
  speaker: 'actor' | 'npc';
  text: string;
  timestamp: string;
}

export interface BackendTranscript {
  turns: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
}
