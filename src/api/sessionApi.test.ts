import { describe, expect, it, vi, beforeEach } from 'vitest';
import { requestJson } from './backendClient';
import { bootstrapConversation, refreshSessionContext } from './sessionApi';

vi.mock('./backendClient', () => ({
  requestJson: vi.fn(),
}));

describe('refreshSessionContext', () => {
  beforeEach(() => vi.clearAllMocks());


  it('uses the smart conversation bootstrap endpoint with game identity', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      success: true,
      session_id: 'session-smart-1',
      conversation_status: 'returning',
      dynamic_context: 'Use the player previous memory naturally.',
      context_status: 'complete',
    } as never);

    const result = await bootstrapConversation('scoped-bearer', 'npc-1', 'actor-1');

    expect(result.session_id).toBe('session-smart-1');
    expect(requestJson).toHaveBeenCalledWith('/v1/conversation/bootstrap', {
      method: 'POST',
      bearerToken: 'scoped-bearer',
      body: {
        character_external_id: 'npc-1',
        actor_external_id: 'actor-1',
      },
      signal: undefined,
    });
  });

  it('refreshes context without changing the active session id', async () => {
    const response = {
      session_id: 'session-1',
      context: { dynamic_context: { status: 'complete', text: 'grounded context' } },
    };
    vi.mocked(requestJson).mockResolvedValue(response as never);

    const result = await refreshSessionContext('bearer', 'session-1', 'What is in the knowledge base?');

    expect(result.session_id).toBe('session-1');
    expect(requestJson).toHaveBeenCalledWith('/v1/session/context/refresh', {
      method: 'POST',
      bearerToken: 'bearer',
      body: {
        session_id: 'session-1',
        knowledge_query: 'What is in the knowledge base?',
      },
      signal: undefined,
    });
  });
});
