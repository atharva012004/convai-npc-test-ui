import { describe, expect, it } from 'vitest';
import { groupConversationTurns } from './conversationTurns';
import type { ConversationMessage } from '../types/conversation';

const msg = (id: string, speaker: 'actor' | 'npc', text: string, timestamp = '2026-08-26T10:00:00.000Z'): ConversationMessage => ({
  id,
  speaker,
  text,
  timestamp,
});

describe('groupConversationTurns', () => {
  it('keeps every actor question directly above its NPC answer', () => {
    const turns = groupConversationTurns([
      msg('a1', 'actor', 'What is Convai?'),
      msg('n1', 'npc', 'Convai is a conversational AI platform.'),
      msg('a2', 'actor', 'What is Tavus?'),
      msg('n2', 'npc', 'Tavus provides AI video agents.'),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0]?.actor?.text).toBe('What is Convai?');
    expect(turns[0]?.npc?.text).toBe('Convai is a conversational AI platform.');
    expect(turns[1]?.actor?.text).toBe('What is Tavus?');
    expect(turns[1]?.npc?.text).toBe('Tavus provides AI video agents.');
  });

  it('preserves an interrupted NPC response before the next actor question', () => {
    const turns = groupConversationTurns([
      msg('a1', 'actor', 'Explain the backend.'),
      msg('n1', 'npc', 'The backend retrieves relevant context'),
      msg('a2', 'actor', 'Stop. What is PageIndex?'),
      msg('n2', 'npc', 'PageIndex is used for document retrieval.'),
    ]);

    expect(turns).toHaveLength(2);
    expect(turns[0]?.npc?.text).toContain('backend retrieves');
    expect(turns[1]?.actor?.text).toBe('Stop. What is PageIndex?');
  });
});
