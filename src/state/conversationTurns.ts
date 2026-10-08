import type { ConversationMessage } from '../types/conversation';

export interface ConversationTurn {
  id: string;
  actor: ConversationMessage | null;
  npc: ConversationMessage | null;
}

/**
 * Presentation-only grouping. The event order from Convai is authoritative;
 * timestamps are not used for ordering because streamed events can share a
 * timestamp. Each actor utterance starts a turn and the following NPC output
 * is displayed directly beneath it.
 */
export function groupConversationTurns(messages: ConversationMessage[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];

  for (const message of messages) {
    if (message.speaker === 'actor') {
      turns.push({
        id: `turn-${message.id}`,
        actor: message,
        npc: null,
      });
      continue;
    }

    const current = turns[turns.length - 1];
    if (current && current.actor && !current.npc) {
      current.npc = message;
    } else {
      turns.push({ id: `turn-${message.id}`, actor: null, npc: message });
    }
  }

  return turns;
}
