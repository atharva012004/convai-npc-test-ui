import { describe, expect, it } from 'vitest';
import { ACTIVE_STATES, TERMINAL_STATES } from './conversationState';

describe('conversation state boundaries', () => {
  it('keeps terminal states explicit', () => {
    expect(TERMINAL_STATES.has('IDLE')).toBe(true);
    expect(TERMINAL_STATES.has('COMPLETED')).toBe(true);
    expect(TERMINAL_STATES.has('READY')).toBe(false);
  });

  it('keeps startup and live states in the active set', () => {
    expect(ACTIVE_STATES.has('STARTING_BACKEND_SESSION')).toBe(true);
    expect(ACTIVE_STATES.has('CONNECTING_CONVAI')).toBe(true);
    expect(ACTIVE_STATES.has('LISTENING')).toBe(true);
    expect(ACTIVE_STATES.has('IDLE')).toBe(false);
  });
});
