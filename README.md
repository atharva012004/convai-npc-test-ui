# AI NPC Test Console

Local React + TypeScript + Vite test UI for the production AI Memory & Knowledge Backend direct conversation facade.

**This is a frontend integration fix only.** It does not implement Memory, PageIndex, Knowledge retrieval, Narrative resolution, Context Intelligence, or Dynamic Context generation. The existing backend remains authoritative.

## Final runtime architecture

```text
React UI
  ↓
POST /v1/client/session/bootstrap
  ↓
short-lived scoped backend token
  ↓
completed player message
  ↓
POST /v1/conversation
  ↓
Backend automatically creates/reuses session
  ↓
Memory + Narrative + Knowledge/PageIndex + Context Intelligence + LLM
  ↓
NPC response text
  ↓
Conversation monitor / game TTS / avatar
```

The UI no longer calls `/v1/session/start`, `/v1/session/context/refresh`, `/v1/convai/auth/token`, or the Convai Web SDK for the direct conversation test. Those existing backend routes and the existing Convai flow remain available and unchanged.

The game-facing contract is intentionally simple: send a completed message with the character and actor identifiers. The backend owns session creation/reuse and all intelligence routing.


## Direct conversation testing

1. Start the backend on `http://localhost:8000`.
2. Start this UI with `npm run dev`.
3. Click **Start conversation**. This only bootstraps secure client access; it does not require a knowledge query or session ID.
4. Type or speak a completed message.
5. The UI calls `POST /v1/conversation` with the character, actor, and message. The backend creates/reuses the session automatically and returns the NPC response text.
6. Click **End conversation** to persist and close the session returned by the direct facade.

No `knowledge_query` is entered in the UI. Knowledge retrieval is decided by the backend from the completed message.

## Direct conversation + Convai voice flow

The game-facing path is intentionally split by responsibility:

1. `POST /v1/client/session/bootstrap` authenticates the game client.
2. The UI obtains a short-lived Convai client token from `/v1/convai/auth/token`.
3. One persistent Convai Web SDK client is connected for the whole active conversation.
4. For every completed player question, `POST /v1/conversation` is called with `generate_response=false`. The backend automatically creates/reuses the active session and runs Memory/Narrative/Knowledge/PageIndex/Context Intelligence.
5. The returned dynamic context is applied with `mode: replace` to the same Convai client.
6. The UI sends the player question exactly once with `sendUserTextMessage()`; Convai generates the single character response and plays the character's configured voice through its WebRTC/AudioRenderer path.
7. Ending the conversation saves the complete UI transcript through `/v1/session/end`, where the backend memory runtime can process it.

The backend does not call Convai `/tts` and does not send its own generated answer back to Convai as a second prompt.


## Diagnostics correctness
The Development diagnostics panel is request-scoped and never carries stale counts or fingerprints into a new question. Values are read from the latest backend conversation response; missing backend diagnostics are displayed as unavailable.
