import { describe, expect, it } from 'vitest';
import { toBackendTranscript, toTranscriptTurns } from './transcript';

const messages = [
  { id: '1', speaker: 'actor' as const, text: 'Hello', timestamp: '2026-08-25T10:00:00.000Z' },
  { id: '2', speaker: 'npc' as const, text: 'Hi there', timestamp: '2026-08-25T10:00:01.000Z' },
];

describe('transcript normalization', () => {
  it('preserves the live UI transcript', () => {
    expect(toTranscriptTurns(messages)).toEqual(messages);
  });

  it('maps actor/npc to the backend session contract', () => {
    expect(toBackendTranscript(messages)).toEqual({
      turns: [
        { role: 'user', content: 'Hello', timestamp: '2026-08-25T10:00:00.000Z' },
        { role: 'assistant', content: 'Hi there', timestamp: '2026-08-25T10:00:01.000Z' },
      ],
    });
  });
});
