import type { ConversationMessage } from '../types/conversation';
import { groupConversationTurns } from '../state/conversationTurns';

export function TranscriptPanel({ messages }: { messages: ConversationMessage[] }) {
  const turns = groupConversationTurns(messages);

  return (
    <section className="panel transcript-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Conversation record</div>
          <h2>Final transcript</h2>
        </div>
        <span className="message-count">{turns.length} {turns.length === 1 ? 'turn' : 'turns'}</span>
      </div>
      <div className="transcript-list">
        {turns.length === 0 ? (
          <div className="empty-state">No final transcript turns yet.</div>
        ) : turns.map((turn, index) => (
          <article className="transcript-turn" key={turn.id}>
            <div className="transcript-turn-head">
              <strong>Turn {index + 1}</strong>
              <span>
                {turn.actor ? new Date(turn.actor.timestamp).toLocaleTimeString() :
                  turn.npc ? new Date(turn.npc.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
            {turn.actor && (
              <div className="transcript-message actor">
                <strong className="actor-label">Actor</strong>
                <p>{turn.actor.text}</p>
              </div>
            )}
            {turn.npc && (
              <div className="transcript-message npc">
                <strong className="npc-label">NPC</strong>
                <p>{turn.npc.text}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
