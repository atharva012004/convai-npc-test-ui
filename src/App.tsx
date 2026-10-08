import { AudioContext, AudioRenderer } from '@convai/web-sdk';
import { useConversation } from './hooks/useConversation';
import { env } from './config/env';
import { NpcPanel } from './components/NpcPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { VoiceControls } from './components/VoiceControls';
import { TextInput } from './components/TextInput';
import { TranscriptPanel } from './components/TranscriptPanel';
import { DebugPanel } from './components/DebugPanel';
import { BrowserSpeechInput } from './components/BrowserSpeechInput';

export default function App() {
  const conversation = useConversation();
  const dynamicContext = conversation.session?.context.dynamic_context ?? null;
  const convaiCharacterId = conversation.convaiCharacterId;

  const content = (
      <main className="app-shell">
        {conversation.convaiClient ? (
          <AudioContext.Provider value={conversation.convaiClient.room}>
            <AudioRenderer />
          </AudioContext.Provider>
        ) : null}
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true"><span>AI</span></div>
            <div>
              <div className="eyebrow">AI character test workspace</div>
              <h1>NPC Conversation Studio</h1>
              <p>Test the single game-facing path: completed message → backend memory/context/knowledge → NPC response.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="environment-badge"><span className="live-dot" /> LOCAL · {env.frontendPort}</div>
            <div className="boundary-badge">Backend intelligence protected</div>
          </div>
        </header>

        <section className="layout-grid">
          <div className="main-column">
            <NpcPanel
              state={conversation.uiState}
              characterExternalId={env.characterExternalId}
              convaiCharacterId={convaiCharacterId}
              session={conversation.session}
              convaiClient={conversation.convaiClient}
            />

            <section className="panel context-query-panel">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">Direct conversation API</div>
                  <h2>Backend-controlled conversation</h2>
                </div>
                <span className="context-mode"><span className="mini-dot mini-dot-active" /> Automatic</span>
              </div>
              <p className="field-help">
                Enter or speak a completed message below. Each completed utterance goes directly through
                <code>POST /v1/conversation</code>. The backend automatically creates or reuses the session, loads
                Memory, Narrative, Knowledge/PageIndex and Context Intelligence, then calls Convai for the
                character response and configured voice. The UI plays the returned Convai audio and does not send
                the same question to Convai a second time.
              </p>
            </section>

            <ConversationPanel messages={conversation.messages} />

            <section className="panel controls-panel">
              <div className="input-heading">
                <div>
                  <div className="eyebrow">Talk to the character</div>
                  <h3>Voice or text input</h3>
                </div>
                <span className="muted">Backend handles memory/context/knowledge · Convai voice is delivered separately</span>
              </div>
              <VoiceControls
                state={conversation.uiState}
                sessionMode={conversation.sessionMode}
                onSessionModeChange={conversation.setSessionMode}
                hasPreviousSession={conversation.hasPreviousSession}
                previousSessionSavedAt={conversation.previousSession?.savedAt}
                onStart={() => {
                  void conversation.start(conversation.sessionMode);
                }}
                onStop={() => {
                  void conversation.stop();
                }}
              />
              <div className="voice-input-row">
                <BrowserSpeechInput
                  state={conversation.uiState}
                  onFinalText={conversation.sendText}
                  onSpeechStart={conversation.interruptForExplicitUserTurn}
                />
                <TextInput state={conversation.uiState} onSend={conversation.sendText} />
              </div>
              {conversation.error && <div className="error-banner" role="alert">{conversation.error}</div>}
              {conversation.transcriptSaveMessage && <div className="success-banner">{conversation.transcriptSaveMessage}</div>}
            </section>

            <TranscriptPanel messages={conversation.messages} />
          </div>

          <aside className="side-column">
            <section className="panel session-info">
              <div className="eyebrow">System monitor</div>
              <h2>Runtime status</h2>
              <dl>
                <div><dt>Backend</dt><dd>{env.backendUrl}</dd></div>
                <div><dt>Character</dt><dd>{env.characterExternalId}</dd></div>
                <div><dt>Actor</dt><dd>{env.actorExternalId}</dd></div>
                <div><dt>Session started</dt><dd>{conversation.session?.started_at ? new Date(conversation.session.started_at).toLocaleTimeString() : '—'}</dd></div>
                <div><dt>Context</dt><dd>{conversation.diagnostics.context}</dd></div>
                <div><dt>Context applied</dt><dd>{conversation.diagnostics.contextApplied.toUpperCase()}</dd></div>
                <div><dt>Runtime</dt><dd>{conversation.diagnostics.conversationRuntime}</dd></div>
              </dl>
            </section>

            <DebugPanel diagnostics={conversation.diagnostics} />

            <section className="panel architecture-card">
              <div className="eyebrow">How this works</div>
              <h2>Clean ownership boundaries</h2>
              <p className="architecture-intro">The UI is a test console. Intelligence stays in the systems responsible for it.</p>
              <ul>
                <li>Memory: backend</li>
                <li>Narrative: backend</li>
                <li>PageIndex/Knowledge: backend</li>
                <li>Context Intelligence: backend</li>
                <li>Dynamic Context: backend</li>
                <li>NPC response: returned by the unified backend API</li>
                <li>NPC voice: delivered separately from the conversation JSON contract</li>
                <li>Transcript lifecycle: UI + backend</li>
              </ul>
            </section>
          </aside>
        </section>
      </main>
  );

  return content;
}
