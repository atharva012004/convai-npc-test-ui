import type { SessionStartResponse } from '../types/backend';
import { SessionStatus } from './SessionStatus';
import type { UiState } from '../types/conversation';
import type { ConvaiClientInstance } from '../convai/convaiClient';

interface Props {
  state: UiState;
  characterExternalId: string;
  convaiCharacterId: string | null;
  session: SessionStartResponse | null;
  convaiClient: ConvaiClientInstance | null;
}

function StatusDot({ active = false }: { active?: boolean }) {
  return <span className={`mini-dot ${active ? 'mini-dot-active' : ''}`} aria-hidden="true" />;
}

export function NpcPanel({
  state,
  characterExternalId,
  convaiCharacterId,
  session,
  convaiClient,
}: Props) {
  const connected = state === 'READY' || state === 'LISTENING' || state === 'REFRESHING_CONTEXT' || state === 'NPC_SPEAKING';

  return (
    <section className="panel npc-section">
      <div className="npc-header">
        <div className="npc-identity-mark" aria-hidden="true">
          <span>{characterExternalId.slice(0, 1).toUpperCase()}</span>
          <i className={connected ? 'online-ring online-ring-on' : 'online-ring'} />
        </div>
        <div className="npc-meta">
          <div className="eyebrow">NPC workspace</div>
          <div className="npc-title-row">
            <h2>{characterExternalId}</h2>
            <span className={connected ? 'connection-badge connection-badge-on' : 'connection-badge'}>
              <StatusDot active={connected} /> {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <p>
            {convaiCharacterId
              ? 'The direct conversation API is ready. Each completed message is processed by the backend before the NPC response is returned.'
              : 'Character mapping is verified by the backend conversation facade.'}
          </p>
          <div className="npc-meta-row">
            <SessionStatus state={state} />
            {session && <span className="session-badge">Session {session.id.slice(0, 8)}…</span>}
          </div>
        </div>
      </div>

      <div className="npc-presentation">
        <div className="presentation-heading">
          <div>
            <div className="eyebrow">NPC response stage</div>
            <h3>Direct conversation response</h3>
            <p className="presentation-subtitle">The backend returns response text; the game can connect its own TTS or avatar presentation without changing the backend pipeline.</p>
          </div>
          <div className="presentation-signals">
            <span className="signal signal-on">BACKEND GROUNDED</span>
            <span className="signal">TEXT RESPONSE READY</span>
          </div>
        </div>

        <div className="avatar-stage" aria-label="NPC response presentation placeholder">
          <div className="stage-grid" aria-hidden="true" />
          <div className="stage-glow" aria-hidden="true" />
          <div className="stage-content">
            <div className="stage-avatar" aria-hidden="true">
              <span>{characterExternalId.slice(0, 1).toUpperCase()}</span>
              <div className="stage-pulse" />
            </div>
            <span className="stage-kicker">DIRECT API</span>
            <strong>{characterExternalId}</strong>
            <p>
              {connected
                ? 'Direct conversation runtime is ready. Use the response text with your game TTS/avatar system.'
                : 'Start the conversation to establish secure backend access.'}
            </p>
            <div className="stage-status">
              <StatusDot active={connected} />
              <span>{connected ? 'Direct conversation API ready' : 'Waiting for conversation'}</span>
            </div>
          </div>
          <div className="stage-corner stage-corner-tl" aria-hidden="true" />
          <div className="stage-corner stage-corner-br" aria-hidden="true" />
        </div>

        <div className="embed-readiness">
          <div className="readiness-icon" aria-hidden="true">TV</div>
          <div>
            <strong>NPC response / avatar slot</strong>
            <span>Use the returned NPC response text with your preferred TTS, animation, or avatar system. No backend intelligence or conversation logic changes are required.</span>
          </div>
          <span className="readiness-state">DIRECT API READY</span>
        </div>

        <div className="runtime-flow" aria-label="Conversation architecture">
          <div className="flow-step"><span>01</span><strong>Question</strong><small>UI</small></div>
          <div className="flow-line" />
          <div className="flow-step"><span>02</span><strong>Context</strong><small>Backend</small></div>
          <div className="flow-line" />
          <div className="flow-step"><span>03</span><strong>Conversation</strong><small>Backend</small></div>
          <div className="flow-line" />
          <div className="flow-step"><span>04</span><strong>Response</strong><small>Unity / TTS</small></div>
        </div>
      </div>
    </section>
  );
}
