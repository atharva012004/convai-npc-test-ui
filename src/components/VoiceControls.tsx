import type { UiState } from '../types/conversation';

interface Props {
  state: UiState;
  onStart: () => void;
  onStop: () => void;
  sessionMode: 'new' | 'resume';
  onSessionModeChange: (mode: 'new' | 'resume') => void;
  hasPreviousSession: boolean;
  previousSessionSavedAt?: string;
}

export function VoiceControls({
  state,
  onStart,
  onStop,
  sessionMode,
  onSessionModeChange,
  hasPreviousSession,
  previousSessionSavedAt,
}: Props) {
  const canStart = state === 'IDLE' || state === 'COMPLETED' || state === 'ERROR';
  const canStop = !canStart && state !== 'STOPPING' && state !== 'SAVING_TRANSCRIPT';

  return (
    <>
    <div className="session-mode-row" role="group" aria-label="Session mode">
      <button
        type="button"
        className={`session-mode-button ${sessionMode === 'new' ? 'session-mode-active' : ''}`}
        onClick={() => onSessionModeChange('new')}
        disabled={!canStart}
      >
        <strong>New session</strong>
        <small>Start fresh</small>
      </button>
      <button
        type="button"
        className={`session-mode-button ${sessionMode === 'resume' ? 'session-mode-active' : ''}`}
        onClick={() => onSessionModeChange('resume')}
        disabled={!canStart || !hasPreviousSession}
        title={hasPreviousSession ? 'Continue the most recently saved session' : 'No previous session is available yet'}
      >
        <strong>Continue previous</strong>
        <small>{hasPreviousSession ? (previousSessionSavedAt ? `Saved ${new Date(previousSessionSavedAt).toLocaleString()}` : 'Resume saved session') : 'No previous session'}</small>
      </button>
    </div>
    <div className="controls-row">
      <button className="primary-button start-button" onClick={onStart} disabled={!canStart}>
        <span className="button-icon">▶</span>
        <span><strong>Start conversation</strong><small>Authenticate one-API access</small></span>
      </button>
      <button className="secondary-button stop-button" onClick={onStop} disabled={!canStop}>
        <span className="button-icon">■</span>
        <span><strong>End conversation</strong><small>Save transcript & close</small></span>
      </button>
    </div>
    </>
  );
}
