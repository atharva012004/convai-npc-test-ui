import { describe, expect, it, vi } from 'vitest';
import { applyDynamicContext, interruptCurrentResponse, shouldInterruptForExplicitUserTurn, type ConvaiClientInstance } from './convaiClient';

describe('applyDynamicContext', () => {
  it('replaces the Convai runtime context for non-empty backend context', async () => {
    const client = {
      updateContext: vi.fn(),
    } as unknown as ConvaiClientInstance;

    await applyDynamicContext(client, '  [KNOWLEDGE]\n- grounded answer  ');

    expect(client.updateContext).toHaveBeenCalledWith({
      text: '[KNOWLEDGE]\n- grounded answer',
      mode: 'replace',
      run_llm: 'false',
    });
  });

  it('resets Convai runtime context when backend returns valid empty context', async () => {
    const client = {
      updateContext: vi.fn(),
    } as unknown as ConvaiClientInstance;

    await applyDynamicContext(client, '   ');

    expect(client.updateContext).toHaveBeenCalledWith({
      mode: 'reset',
      run_llm: 'false',
    });
  });
});


describe('shouldInterruptForExplicitUserTurn', () => {
  it('interrupts only when Convai is actively thinking or speaking', () => {
    expect(shouldInterruptForExplicitUserTurn({ isThinking: false, isSpeaking: false })).toBe(false);
    expect(shouldInterruptForExplicitUserTurn({ isThinking: true, isSpeaking: false })).toBe(true);
    expect(shouldInterruptForExplicitUserTurn({ isThinking: false, isSpeaking: true })).toBe(true);
    expect(shouldInterruptForExplicitUserTurn({ isThinking: true, isSpeaking: true })).toBe(true);
  });
});

describe('interruptCurrentResponse', () => {
  it('sends the SDK interrupt only when the caller explicitly invokes it', () => {
    const client = { sendInterruptMessage: vi.fn() } as unknown as ConvaiClientInstance;
    interruptCurrentResponse(client);
    expect(client.sendInterruptMessage).toHaveBeenCalledTimes(1);
  });
});

