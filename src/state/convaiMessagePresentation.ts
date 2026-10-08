import type { ConvaiMessageLike } from '../types/convai';
import type { ConversationMessage } from '../types/conversation';

export function normalizeConvaiTimestamp(value: ConvaiMessageLike['timestamp']): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Convai streaming events can arrive either as deltas ("Hello", " there")
 * or as cumulative snapshots ("Hello", "Hello there"). Treat both forms
 * as one presentation message instead of printing every transport chunk.
 */
export function mergeStreamText(existing: string, incoming: string): string {
  const current = existing.trim();
  const next = incoming.trim();
  if (!current) return next;
  if (!next) return current;
  if (current === next) return current;
  if (next.startsWith(current)) return next;
  if (current.startsWith(next)) return current;

  // Some streaming transports deliver overlapping windows rather than pure
  // deltas. Find the largest suffix/prefix overlap so the UI never renders
  // duplicated words while the spoken response is still streaming.
  const maxOverlap = Math.min(current.length, next.length);
  for (let size = maxOverlap; size >= 2; size -= 1) {
    if (current.slice(-size).toLowerCase() === next.slice(0, size).toLowerCase()) {
      return `${current}${next.slice(size)}`.replace(/\s+/g, ' ').trim();
    }
  }

  return `${current} ${next}`.replace(/\s+/g, ' ').trim();
}

/**
 * Final bot-transcription is the speech-facing representation. If it arrives
 * after bot-llm-text chunks, replace the streamed draft with the final spoken
 * text so the transcript never contains both versions.
 */
export function finalizeNpcText(existing: string, incoming: string): string {
  const current = existing.trim();
  const next = incoming.trim();
  if (!current) return next;
  if (!next) return current;
  if (next.startsWith(current) || next.length >= current.length) return next;
  return current;
}

/**
 * Presentation-only normalization:
 * - user-transcription updates the current actor turn instead of creating
 *   repeated/cumulative questions;
 * - bot-llm-text is aggregated into one visible NPC response;
 * - bot-transcription replaces the streamed NPC draft with the final speech;
 * - unrelated transport messages are ignored.
 */
export function appendConvaiMessage(
  previous: ConversationMessage[],
  message: ConvaiMessageLike,
): ConversationMessage[] {
  const isActor = message.type === 'user-transcription';
  const isNpcDraft = message.type === 'bot-llm-text';
  const isNpcFinal = message.type === 'bot-transcription';

  if ((!isActor && !isNpcDraft && !isNpcFinal) || !message.content?.trim()) {
    return previous;
  }

  const next = previous.map((item) => ({ ...item }));
  const text = message.content.trim();
  const timestamp = normalizeConvaiTimestamp(message.timestamp);
  const lastIndex = next.length - 1;
  const last = lastIndex >= 0 ? next[lastIndex] : undefined;

  if (isActor) {
    // STT can emit cumulative revisions for the same utterance. Keep exactly
    // one actor line until the NPC has started responding.
    if (last?.speaker === 'actor') {
      const nextText =
        text.startsWith(last.text.trim()) || last.text.trim().startsWith(text)
          ? text.length >= last.text.trim().length
            ? text
            : last.text
          : text;
      next[lastIndex] = {
        ...last,
        text: nextText,
        timestamp,
        id: message.id?.trim() || last.id,
      };
    } else {
      next.push({
        id: message.id?.trim() || `actor-${Date.now()}`,
        speaker: 'actor',
        text,
        timestamp,
      });
    }
    return next;
  }

  if (last?.speaker === 'npc') {
    next[lastIndex] = {
      ...last,
      text: isNpcFinal ? finalizeNpcText(last.text, text) : mergeStreamText(last.text, text),
      timestamp: isNpcFinal ? timestamp : last.timestamp,
    };
  } else {
    next.push({
      id: message.id?.trim() || `npc-${Date.now()}`,
      speaker: 'npc',
      text,
      timestamp,
    });
  }

  return next;
}
