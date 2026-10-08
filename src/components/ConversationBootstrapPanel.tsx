interface Props {
  characterExternalId: string;
  actorExternalId: string;
  state: 'IDLE' | 'STARTING_BACKEND_SESSION' | 'BACKEND_SESSION_READY' | 'GETTING_CONVAI_AUTH' | 'INITIALIZING_CONVAI' | 'CONNECTING_CONVAI' | 'READY' | 'LISTENING' | 'REFRESHING_CONTEXT' | 'NPC_SPEAKING' | 'STOPPING' | 'SAVING_TRANSCRIPT' | 'COMPLETED' | 'ERROR';
  bootstrapDecision: string | null;
  currentSessionId: string | null;
  resumeSessionId: string;
  onResumeSessionIdChange: (value: string) => void;
  onStart: (resumeSessionId?: string) => void;
}

export function ConversationBootstrapPanel({
  characterExternalId,
  actorExternalId,
  state,
  bootstrapDecision,
  currentSessionId,
  resumeSessionId,
  onResumeSessionIdChange,
  onStart,
}: Props) {
  const canStart = state === 'IDLE' || state === 'COMPLETED' || state === 'ERROR';
  const hasResumeId = Boolean(resumeSessionId.trim());

  return (
    <section className="panel bootstrap-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Conversation bootstrap</div>
          <h2>One conversation-start API</h2>
        </div>
        <span className="context-mode">
          <span className="mini-dot mini-dot-active" /> Backend decides
        </span>
      </div>

      <p className="field-help">
        The UI always starts the conversation through <code>POST /v1/conversation/bootstrap</code>.
        Leave Session ID empty to let the backend decide whether this is a new, returning, or already-active
        conversation. Enter an existing Session ID only when you want to explicitly resume that persisted session.
      </p>

      <div className="bootstrap-grid">
        <div className="bootstrap-identity">
          <div className="bootstrap-field">
            <label htmlFor="bootstrap-character">Character External ID</label>
            <input id="bootstrap-character" value={characterExternalId} readOnly aria-readonly="true" />
          </div>
          <div className="bootstrap-field">
            <label htmlFor="bootstrap-actor">Actor External ID</label>
            <input id="bootstrap-actor" value={actorExternalId} readOnly aria-readonly="true" />
          </div>
        </div>

        <div className="bootstrap-field bootstrap-session-field">
          <label htmlFor="resume-session-id">Existing Session ID <span>(optional)</span></label>
          <input
            id="resume-session-id"
            value={resumeSessionId}
            onChange={(event) => onResumeSessionIdChange(event.target.value)}
            placeholder="Leave empty for automatic new/returning decision"
            autoComplete="off"
            spellCheck={false}
            disabled={!canStart}
          />
          <small>
            {hasResumeId
              ? 'This session will be securely resumed before the conversation bootstrap runs.'
              : 'Automatic mode: the backend creates a new session when needed or reuses an active one.'}
          </small>
        </div>
      </div>

      <div className="bootstrap-actions">
        <button
          className="primary-button start-button"
          onClick={() => onStart(hasResumeId ? resumeSessionId.trim() : undefined)}
          disabled={!canStart}
        >
          <span className="button-icon">▶</span>
          <span>
            <strong>{hasResumeId ? 'Resume & start conversation' : 'Start conversation'}</strong>
            <small>{hasResumeId ? 'Use the supplied persisted session' : 'Let backend decide new or returning'}</small>
          </span>
        </button>

        {bootstrapDecision && (
          <div className="bootstrap-result" role="status" aria-live="polite">
            <span className="bootstrap-result-label">Backend decision</span>
            <strong>{bootstrapDecision}</strong>
          </div>
        )}
      </div>
    </section>
  );
}
