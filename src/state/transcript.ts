import type { BackendTranscript, TranscriptTurn } from '../types/backend';
import type { ConversationMessage } from '../types/conversation';

export function toTranscriptTurns(messages: ConversationMessage[]): TranscriptTurn[] {
  return messages.map((message) => ({ ...message }));
}

export function toBackendTranscript(messages: ConversationMessage[]): BackendTranscript {
  return {
    turns: messages.map((message) => ({
      role: message.speaker === 'actor' ? 'user' : 'assistant',
      content: message.text,
      timestamp: message.timestamp,
    })),
  };
}
