import { useEffect, useRef } from 'react';
import type { ConversationMessage } from '../types/conversation';
import { groupConversationTurns } from '../state/conversationTurns';

function MessageBlock({ message }: { message: ConversationMessage }) {
  const isActor = message.speaker === 'actor';
  return (
    <div className={`turn-message ${message.speaker}`}>
      <div className="message-avatar" aria-hidden="true">{isActor ? 'Y' : 'A'}</div>
      <div className="message-body">
        <div className="message-label">{isActor ? 'You' : 'Elizabeth'}</div>
        <p>{message.text}</p>
        <time>{new Date(message.timestamp).toLocaleTimeString()}</time>
      </div>
    </div>
  );
}

export function ConversationPanel({ messages }: { messages: ConversationMessage[] }) {
  const turns = groupConversationTurns(messages);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [messages.length, turns.length]);

  return (
    <section className="panel conversation-panel">
      <div className="section-heading conversation-heading">
        <div>
          <div className="eyebrow">Conversation monitor</div>
          <h2>Live conversation</h2>
          <p className="section-subtitle">Each turn keeps your question and Elizabeth's complete response together.</p>
        </div>
        <span className="message-count">{turns.length} {turns.length === 1 ? 'turn' : 'turns'}</span>
      </div>
      <div ref={scrollRef} className="conversation-scroll" aria-live="polite">
        {turns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">◌</div>
            <strong>No conversation yet</strong>
            <span>Start a session, then type or speak a message. Questions that need knowledge are refreshed through the backend automatically.</span>
          </div>
        ) : (
          turns.map((turn, index) => (
            <article className="conversation-turn" key={turn.id}>
              <div className="turn-number">Turn {String(index + 1).padStart(2, '0')}</div>
              {turn.actor && <MessageBlock message={turn.actor} />}
              {turn.npc ? <MessageBlock message={turn.npc} /> : <div className="turn-pending"><span className="thinking-dots">•••</span> Elizabeth is responding…</div>}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
