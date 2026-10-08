# Question-by-question grounding fix

## Problem

The previous UI sent `knowledge_query` only to `POST /v1/session/start`. That means PageIndex/Knowledge retrieval ran once at conversation startup. Later questions were sent directly to the same Convai client, so a question about a different knowledge section could not cause a new backend retrieval.

The backend was therefore healthy, but the retrieval query was frozen at startup.

## Corrected flow

```text
Start
  ↓
POST /v1/client/session/bootstrap
  ↓
POST /v1/session/start (optional initial query)
  ↓
one ConvaiClient
  ↓

For every finalized question:
  ↓
POST /v1/session/context/refresh
  ↓
existing ContextBuilder
  ├─ Memory
  ├─ Narrative
  ├─ PageIndex / Knowledge retrieval using THIS question
  └─ Context Intelligence
  ↓
context.dynamic_context.text
  ↓
updateDynamicInfo() on the SAME ConvaiClient
  ↓
sendUserTextMessage() on the SAME ConvaiClient
  ↓
Elizabeth response
```

`/v1/session/context/refresh` reuses the existing active session. It does not create another Session, issue another Convai token, call Convai, or implement frontend RAG.

## Voice gate

Native Convai microphone input is intentionally not opened automatically because it sends the utterance directly into the Convai runtime before the frontend can synchronously wait for the backend's question-specific retrieval.

The test UI therefore uses browser speech recognition as a question gate:

1. Actor finishes speaking.
2. Browser produces the final text.
3. Backend retrieves context for that exact text.
4. UI applies that context to the existing Convai client.
5. UI sends the exact text to Convai.
6. Convai narrates the answer through the existing AudioRenderer.

If browser speech recognition is unavailable, typed input remains available.

When the actor deliberately starts speaking while Elizabeth is talking, the UI interrupts the current Convai response first, refreshes context for the new question, and then sends the new question. Late chunks from the interrupted response are ignored by the presentation layer.
