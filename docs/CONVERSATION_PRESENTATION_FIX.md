# Conversation presentation and transcript fix

## What changed

- The UI now listens to Convai's `message` event for new conversation content instead of consuming `messagesChange` history snapshots.
- Only `user-transcription` is rendered as an actor question.
- Internal `user-llm-text` events are ignored and never displayed.
- `bot-llm-text` streaming chunks are coalesced into one NPC answer instead of appearing as separate rows.
- Event arrival order is preserved; timestamps are not used to reorder streamed turns.
- A new actor turn starts a new presentation turn, so an interrupted NPC response remains above the new question.
- Live `userTranscriptionChange` text is treated as intermediate STT and is not persisted into the final transcript.
- Conversation and Final Transcript use the same paired turn presentation: Actor question → NPC answer.
- Late bot chunks from an interrupted response are guarded from being attached to a later user turn.

## Architecture boundary

The UI does not perform retrieval, memory, narrative generation, or knowledge synthesis. The backend remains responsible for Dynamic Context. Convai remains responsible for the live conversational transport, speech, TTS, and avatar/lipsync.
