export type UiState =
  | 'IDLE'
  | 'STARTING_BACKEND_SESSION'
  | 'BACKEND_SESSION_READY'
  | 'GETTING_CONVAI_AUTH'
  | 'INITIALIZING_CONVAI'
  | 'CONNECTING_CONVAI'
  | 'READY'
  | 'LISTENING'
  | 'REFRESHING_CONTEXT'
  | 'NPC_SPEAKING'
  | 'STOPPING'
  | 'SAVING_TRANSCRIPT'
  | 'COMPLETED'
  | 'ERROR';

export interface Diagnostics {
  backend: 'unknown' | 'connected' | 'error';
  bootstrap: 'idle' | 'pending' | 'success' | 'error';
  sessionStart: 'idle' | 'pending' | 'success' | 'error';
  context: 'idle' | 'pending' | 'complete' | 'partial' | 'empty' | 'failed' | 'cancelled';
  contextApplied: 'no' | 'yes' | 'failed';
  contextFingerprint: string | null;
  convaiAuth: 'idle' | 'pending' | 'received' | 'error';
  convai: 'idle' | 'initializing' | 'connected' | 'disconnected' | 'error';
  transcript: 'idle' | 'collecting' | 'saving' | 'saved' | 'error';
  startupMs: number | null;
  messageCount: number;
  memoryCount: number | null;
  narrativeCount: number | null;
  knowledgeCount: number | null;
  selectedCount: number | null;
  droppedCount: number | null;
  contextTokens: number | null;
  diagnosticsSource: 'backend-response' | 'unavailable';
  contextRefreshes: number;
  lastQuestion: string | null;
  conversationRuntime: 'single-backend-api' | 'single-convai-client' | 'not-started';
}

export interface ConversationMessage {
  id: string;
  speaker: 'actor' | 'npc';
  text: string;
  timestamp: string;
}
