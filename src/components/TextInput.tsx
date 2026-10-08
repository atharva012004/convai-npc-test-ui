import { useState, type FormEvent } from 'react';
import type { UiState } from '../types/conversation';

interface Props {
  state: UiState;
  onSend: (text: string) => Promise<void>;
}

export function TextInput({ state, onSend }: Props) {
  const [text, setText] = useState('');
  const enabled = state === 'READY' || state === 'LISTENING' || state === 'NPC_SPEAKING';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled || !text.trim()) return;
    const value = text;
    setText('');
    await onSend(value);
  }

  return (
    <form className="text-input-row" onSubmit={submit}>
      <div className="text-field-wrap">
        <span className="text-field-icon" aria-hidden="true">⌘</span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={!enabled}
          placeholder={state === 'NPC_SPEAKING' ? 'Type a message to interrupt Elizabeth and start the next turn…' : enabled ? 'Ask Elizabeth anything…' : 'Start the conversation to send a message'}
          aria-label="Message for NPC"
        />
        <span className="text-field-hint">Enter ↵</span>
      </div>
      <button className="send-button" type="submit" disabled={!enabled || !text.trim()} aria-label="Send message">
        <span>{state === 'NPC_SPEAKING' ? 'Interrupt & send' : 'Send'}</span><span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
