import { describe, expect, it } from 'vitest';
import { completionDelayMs, getBufferedText } from './BrowserSpeechInput';

describe('browser speech completion', () => {
  it('combines committed and interim speech before submission', () => {
    expect(getBufferedText('can you tell me about', 'HeyGen AI')).toBe('can you tell me about HeyGen AI');
  });

  it('waits longer for grammatically incomplete utterances', () => {
    expect(completionDelayMs('can you tell me about')).toBeGreaterThan(completionDelayMs('can you tell me about HeyGen AI'));
  });

  it('finishes quickly when terminal punctuation is recognized', () => {
    expect(completionDelayMs('Can you tell me about HeyGen AI?')).toBe(450);
  });

  it('does not require final recognition before a complete buffered phrase can submit', () => {
    expect(getBufferedText('', 'Can you tell me about HeyGen AI')).toBe('Can you tell me about HeyGen AI');
  });
});
