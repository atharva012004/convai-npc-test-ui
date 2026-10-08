import { describe, expect, it } from 'vitest';
import { appendConvaiMessage } from './convaiMessagePresentation';

const ts = '2026-08-26T10:00:00.000Z';

describe('appendConvaiMessage', () => {
  it('ignores internal user-llm-text noise', () => {
    const result = appendConvaiMessage([], {
      type: 'user-llm-text',
      content: 'unwanted generated user text',
      timestamp: ts,
    });
    expect(result).toEqual([]);
  });

  it('keeps actor then NPC ordering and coalesces streamed NPC chunks', () => {
    let result = appendConvaiMessage([], { type: 'user-transcription', content: 'What is Convai?', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: 'Convai is', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: ' a conversational AI platform.', timestamp: ts });

    expect(result).toHaveLength(2);
    expect(result[0]?.speaker).toBe('actor');
    expect(result[1]?.text).toBe('Convai is a conversational AI platform.');
  });

  it('collapses cumulative actor transcription into one question', () => {
    let result = appendConvaiMessage([], { type: 'user-transcription', content: 'What is', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'user-transcription', content: 'What is HeyGen?', timestamp: ts });

    expect(result).toHaveLength(1);
    expect(result[0]?.speaker).toBe('actor');
    expect(result[0]?.text).toBe('What is HeyGen?');
  });

  it('replaces the streamed NPC draft with the final spoken transcription', () => {
    let result = appendConvaiMessage([], { type: 'user-transcription', content: 'Question', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: 'Draft answer', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-transcription', content: 'Draft answer completed.', timestamp: ts });

    expect(result).toHaveLength(2);
    expect(result[1]?.text).toBe('Draft answer completed.');
  });


  it('merges overlapping streaming windows without duplicating the overlap', () => {
    let result = appendConvaiMessage([], { type: 'user-transcription', content: 'Question', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: 'Convai provides grounded', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: 'grounded conversational AI.', timestamp: ts });

    expect(result[1]?.text).toBe('Convai provides grounded conversational AI.');
  });

  it('starts a new NPC response only after a new actor turn', () => {
    let result = appendConvaiMessage([], { type: 'user-transcription', content: 'First question', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: 'First answer.', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'user-transcription', content: 'Second question', timestamp: ts });
    result = appendConvaiMessage(result, { type: 'bot-llm-text', content: 'Second answer.', timestamp: ts });

    expect(result.map((item) => `${item.speaker}:${item.text}`)).toEqual([
      'actor:First question',
      'npc:First answer.',
      'actor:Second question',
      'npc:Second answer.',
    ]);
  });
});
