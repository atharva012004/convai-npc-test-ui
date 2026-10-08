import type { ConversationBootstrapResponse } from '../types/backend';
import type { UiState } from '../types/conversation';

interface Props {
  state: UiState;
  characterExternalId: string;
  actorExternalId: string;
  bootstrapResult: ConversationBootstrapResponse | null;
  referenceSessionId: string;
  onReferenceSessionIdChange: (value: string) => void;
  referenceSessionSummary: string | null;
  onStart: () => void;
  activeSessionId: string | null;
}

const busyStates: UiState[] = [
  'STARTING_BACKEND_SESSION',
  'BACKEND_SESSION_READY',
  'GETTING_CONVAI_AUTH',
  'INITIALIZING_CONVAI',
  'CONNECTING_CONVAI',
  'STOPPING',
  'SAVING_TRANSCRIPT',
];

function statusLabel(result: ConversationBootstrapResponse | null): string {
  if (!result) return 'Waiting for a conversation trigger';
  if (result.conversation_status === 'new') return 'New relationship · new session';
  if (result.conversation_status === 'returning') return 'Returning actor · new session with memory';
  if (result.conversation_status === 'continued') return 'Active conversation · existing session continued';
  return result.conversation_status;
}

function statusTone(result: ConversationBootstrapResponse | null): string {
  if (!result) return 'setup-status-idle';
  if (result.conversation_status === 'new') return 'setup-status-new';
  if (result.conversation_status === 'returning') return 'setup-status-returning';
  return 'setup-status-continued';
}

export function ConversationSetupPanel({
  state,
  characterExternalId,
  actorExternalId,
  bootstrapResult,
  referenceSessionId,
  onReferenceSessionIdChange,
  referenceSessionSummary,
  onStart,
  activeSessionId,
}: Props) {
  const canStart = state === 'IDLE' || state === 'COMPLETED' || state === 'ERROR';
  const busy = busyStates.includes(state);
  const live = ['READY', 'LISTENING', 'REFRESHING_CONTEXT', 'NPC_SPEAKING'].includes(state);

  return (
    <section className="panel conversation-setup-panel">
      <div className="setup-header">
        <div>
          <div className="eyebrow">Conversation setup</div>
          <h2>One trigger. Backend decides the conversation.</h2>
          <p>
            You do not choose “new” or “resume”. Trigger the conversation once and the backend decides whether this is a first visit,
            a returning visit, or an already-active conversation.
          </p>
        </div>
        <div className={`setup-status ${statusTone(bootstrapResult)}`}>
          <span className="setup-status-dot" />
          <span>{statusLabel(bootstrapResult)}</span>
        </div>
      </div>

      <div className="setup-flow">
        <div className="setup-flow-step setup-flow-step-active">
          <span className="setup-flow-number">1</span>
          <div><strong>Identify</strong><small>Character + actor</small></div>
        </div>
        <span className="setup-flow-line" />
        <div className="setup-flow-step">
          <span className="setup-flow-number">2</span>
          <div><strong>Bootstrap</strong><small>Backend decides</small></div>
        </div>
        <span className="setup-flow-line" />
        <div className="setup-flow-step">
          <span className="setup-flow-number">3</span>
          <div><strong>Connect</strong><small>Convai runtime</small></div>
        </div>
        <span className="setup-flow-line" />
        <div className="setup-flow-step">
          <span className="setup-flow-number">4</span>
          <div><strong>Talk</strong><small>Memory is retained</small></div>
        </div>
      </div>

      <div className="setup-identities">
        <div className="setup-field">
          <label>Character external ID</label>
          <div className="setup-value"><code>{characterExternalId}</code><span>from game config</span></div>
        </div>
        <div className="setup-field">
          <label>Actor external ID</label>
          <div className="setup-value"><code>{actorExternalId}</code><span>from player identity</span></div>
        </div>
      </div>

      <details className="reference-session-box">
        <summary>Test a previous session ID <span>optional</span></summary>
        <div className="reference-session-content">
          <p>
            Optional: enter an <strong>active</strong> session ID to test an explicit continuation. Ended sessions stay ended;
            normal returning conversations are created from relationship memory automatically.
          </p>
          <div className="reference-input-row">
            <input
              value={referenceSessionId}
              onChange={(event) => onReferenceSessionIdChange(event.target.value)}
              placeholder="Paste an active session ID"
              spellCheck={false}
              disabled={!canStart}
              aria-label="Previous session ID"
            />
            {referenceSessionId && <button type="button" className="reference-clear" onClick={() => onReferenceSessionIdChange('')} disabled={!canStart}>Clear</button>}
          </div>
          {referenceSessionSummary && <div className="reference-result">{referenceSessionSummary}</div>}
        </div>
      </details>

      <div className="setup-action-row">
        <div className="setup-action-copy">
          <span className="setup-action-kicker">{live ? 'Conversation active' : busy ? 'Preparing your conversation' : 'Conversation ready'}</span>
          <strong>{activeSessionId ? `Active session · ${activeSessionId.slice(0, 12)}…` : 'Waiting to begin'}</strong>
          <small>{live ? 'Talk to the NPC below. End the session when you are finished.' : 'Click Begin conversation. The backend handles new vs returning automatically.'}</small>
        </div>
        <button type="button" className="primary-button setup-start-button" onClick={onStart} disabled={!canStart}>
          <span className="button-icon">{busy ? '…' : '▶'}</span>
          <span><strong>{state === 'ERROR' ? 'Try again' : 'Begin conversation'}</strong><small>Smart bootstrap</small></span>
        </button>
      </div>

      {bootstrapResult && (
        <div className="bootstrap-result-card">
          <div>
            <span className="eyebrow">Backend decision</span>
            <strong>{statusLabel(bootstrapResult)}</strong>
          </div>
          <div className="bootstrap-result-meta">
            <span>Session</span>
            <code>{bootstrapResult.session_id}</code>
          </div>
          <div className="bootstrap-result-meta">
            <span>Context</span>
            <strong>{bootstrapResult.context_status}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
