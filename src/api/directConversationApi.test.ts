import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from './backendClient';
import { sendDirectConversation } from './directConversationApi';

vi.mock('./backendClient', () => ({
  requestJson: vi.fn(),
}));

describe('sendDirectConversation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the unified conversation endpoint with only the game-facing fields', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      session_id: 'session-1',
      conversation_status: 'new',
      response: 'Clout City is a fictional city.',
    } as never);

    const result = await sendDirectConversation(
      'scoped-token',
      'test_npc_001',
      'player_test_042',
      'What is Clout City?',
    );

    expect(result.response).toBe('Clout City is a fictional city.');
    expect(requestJson).toHaveBeenCalledWith('/v1/conversation', {
      method: 'POST',
      bearerToken: 'scoped-token',
      body: {
        character_external_id: 'test_npc_001',
        actor_external_id: 'player_test_042',
        message: 'What is Clout City?',
      },
      extraHeaders: {
        'X-Diagnostics': 'true',
      },
      signal: undefined,
    });
  });
});
