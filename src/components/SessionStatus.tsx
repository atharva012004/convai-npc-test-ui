import type { UiState } from '../types/conversation';

const labels: Record<UiState, string> = {
  IDLE: 'Disconnected',
  STARTING_BACKEND_SESSION: 'Starting backend session',
  BACKEND_SESSION_READY: 'Backend session ready',
  GETTING_CONVAI_AUTH: 'Getting Convai authorization',
  INITIALIZING_CONVAI: 'Initializing Convai',
  CONNECTING_CONVAI: 'Connecting to NPC',
  READY: 'Ready',
  LISTENING: 'Listening',
  NPC_SPEAKING: 'NPC speaking',
  REFRESHING_CONTEXT: 'Refreshing knowledge context',
  STOPPING: 'Stopping',
  SAVING_TRANSCRIPT: 'Saving transcript',
  COMPLETED: 'Stopped',
  ERROR: 'Error',
};

export function SessionStatus({ state }: { state: UiState }) {
  return (
    <div className={`status-pill status-${state.toLowerCase()}`} aria-live="polite">
      <span className="status-dot" />
      {labels[state]}
    </div>
  );
}
