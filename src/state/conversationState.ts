import type { UiState } from '../types/conversation';

export const TERMINAL_STATES = new Set<UiState>(['IDLE', 'COMPLETED', 'ERROR']);
export const ACTIVE_STATES = new Set<UiState>([
  'STARTING_BACKEND_SESSION',
  'BACKEND_SESSION_READY',
  'GETTING_CONVAI_AUTH',
  'INITIALIZING_CONVAI',
  'CONNECTING_CONVAI',
  'READY',
  'LISTENING',
  'NPC_SPEAKING',
  'STOPPING',
  'SAVING_TRANSCRIPT',
]);
