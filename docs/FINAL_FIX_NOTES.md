# Final UI Fix Notes

This build preserves the previous Convai/backend/session/transcript work and fixes the latest compile/runtime issues.

## Fixed

1. **Pixel Streaming TypeScript error**
   - `serviceUrls` is now part of the local `PixelStreamClient` constructor type.
   - The official Convai embed UMD bundle is pinned to `@convai/experience-embed@0.5.0`, whose documented API supports `serviceUrls.sessionFetch`.

2. **Convai Pixel Streaming API-key boundary**
   - The browser points the published-experience session request at `/__convai/experience/session`.
   - Vite's Node dev server reads `CONVAI_API_KEY` from the backend `.env` and injects it server-side when forwarding to Convai.
   - The master Convai API key is never exposed through a `VITE_*` variable.

3. **Transcript merge TypeScript errors**
   - The `noUncheckedIndexedAccess` case is guarded before updating an existing transcript item.
   - Streaming chunks remain merged into a single actor/NPC turn.

4. **Environment**
   - `FINAL_ENV_TEMPLATE.env` and `.env.example` contain the final local configuration template.
   - The public project client ID and game-auth private-key path remain placeholders because they are project-local values/secrets and cannot safely be guessed.


## Single-runtime correction

The previous build's published Pixel Streaming integration was intentionally removed
from the conversation lifecycle. It created an independent `PixelStreamClient` session
while `useConversation.ts` created a separate Web SDK `ConvaiClient`. That architecture
could not prove that backend Dynamic Context reached the visible Pixel Streaming NPC.

The corrected build has exactly one conversational runtime: the `ConvaiClient` owned by
`useConversation.ts`. `NpcPanel.tsx` only presents the state of that runtime and never
creates a second Convai or Pixel Streaming client.

Dynamic Context is now a hard startup gate:

1. `/v1/session/start` must return a non-empty `dynamic_context` with `status=complete`.
2. The exact `dynamic_context.text` is sent to the connected `ConvaiClient`.
3. A SHA-256 fingerprint of that exact text is recorded in development diagnostics.
4. Only after `updateDynamicInfo()` succeeds can the UI enter `READY`/`LISTENING`.
5. Text and microphone interaction use that same client.
6. Session end disconnects that same client before persisting its transcript.

## Conversation presentation correction

The transcript layer now:
- collapses cumulative STT revisions into one actor question;
- aggregates `bot-llm-text` streaming deltas into one NPC response;
- replaces the streamed NPC draft with `bot-transcription` when available;
- keeps the already-rendered partial response when a speaking turn is interrupted;
- ignores `user-llm-text` and other internal transport noise.

This prevents the repeated-question/repeated-fragment presentation seen in the previous
UI.

## ngrok development correction

When Vite is running in development, all backend requests now use the same-origin
`/__backend` proxy regardless of the browser hostname. This prevents an ngrok-served
HTTPS page from trying to fetch `http://localhost:8000` directly and triggering the
CORS failure previously observed.

The Vite development server also listens on `0.0.0.0` and allows `.ngrok-free.dev`
development hosts.

## Provider limitation

The current official Pixel Streaming embed API documents `expId`, `endUserId`, session
initialization and media/camera controls, but does not document a supported bridge to
an existing Web SDK conversation or a method to inject this backend Dynamic Context
into that Pixel Streaming conversation. The fix therefore does not fabricate such a
bridge.


### Question-specific retrieval correction
The startup `knowledge_query` is no longer treated as the permanent retrieval query. Every finalized question is passed to the backend's question-scoped context refresh, and only after the returned Dynamic Context is applied to the existing Convai client is the question sent to Convai. This prevents the startup-context freeze that caused specific knowledge questions to receive generic 'context does not contain' responses.
