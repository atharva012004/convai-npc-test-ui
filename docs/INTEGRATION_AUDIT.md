# Integration Audit — Existing Backend Phase 8.6

## Backend inspected

The frontend was built against the supplied `AI_Memory_Knowledge_Backend_Phase_8_6_HARDENED.zip` source tree.

Baseline backend test suite executed before frontend work:

- **703 passed**
- **2 skipped**
- **4 warnings**
- **9.93 seconds**

No backend files were modified for this frontend.

## Actual runtime contract used

### 1. Game bootstrap

`POST /v1/client/session/bootstrap`

Headers:

- `X-Client-ID`
- `X-Game-Assertion`
- `X-Request-ID`

Body:

```json
{
  "character_external_id": "...",
  "actor_external_id": "..."
}
```

Response includes a short-lived scoped `access_token` and `expires_at`.

The browser does not create the assertion. In local Vite development, a Node-only Vite middleware creates a fresh assertion from a private key path supplied through a non-`VITE_` environment variable. The private key is never bundled.

### 2. Session start

`POST /v1/session/start`

Authorization:

```text
Authorization: Bearer <scoped backend token>
```

Body:

```json
{
  "character_external_id": "...",
  "actor_external_id": "...",
  "knowledge_query": "... or null"
}
```

The UI consumes `context.dynamic_context` from the existing response and never creates a new Dynamic Context endpoint.

### 3. Convai authentication

`POST /v1/convai/auth/token`

Body:

```json
{
  "character_external_id": "...",
  "actor_external_id": "..."
}
```

The backend returns:

- temporary `api_auth_token`
- `expiration_time`
- `convai_character_id`
- `end_user_id`
- validated binding information

The master Convai API key is not exposed to the browser.

### 4. Dynamic Context

The backend's existing `context.dynamic_context.text` is treated as authoritative. The UI sends that exact semantic text to the current Convai Web SDK through the installed SDK's `updateDynamicInfo(dynamicContextText)` API. The initial session uses `/v1/session/start`; subsequent finalized questions use the minimal `/v1/session/context/refresh` endpoint so the existing backend ContextBuilder can retrieve knowledge for the actual question without creating a second session.

No memory, knowledge, narrative or context-intelligence algorithm exists in this repository.

### 5. Transcript persistence

The current backend's `POST /v1/session/end` schema accepts a JSON object and its memory runtime reads `transcript.turns`. The UI therefore persists:

```json
{
  "turns": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ]
}
```

This is intentionally aligned to the actual current backend implementation rather than the older conceptual `/session/end` example that used an array directly.

## Convai SDK inspected

The client pins `@convai/web-sdk` to **1.7.0**. Current official documentation confirms:

- React and vanilla TypeScript entry points.
- `ConvaiClient` and `connect()`.
- `sendUserTextMessage()`.
- `updateDynamicInfo()`.
- event-driven state/message handling.
- `AudioRenderer` for custom UI audio playback.
- audio-first WebRTC as the default path.
- optional video/lipsync/actions are not required for this first test.

## CORS decision

The backend currently does not need a CORS change for the local test client. Vite proxies `/__backend/*` to the configured backend URL during local development, preserving the backend security posture instead of adding `allow_origins=["*"]`.

## Validation limitation

The execution environment available while creating this artifact could not complete `npm install` because the external npm registry request timed out. Therefore a real `npm run build`, `npm test`, and browser execution against a live Convai account could not honestly be claimed here.

A TypeScript transpilation/syntax audit was run over all frontend TypeScript files and `vite.config.ts`:

- **24 files checked**
- **0 transpilation diagnostics**

The backend's full automated suite was also rerun and remained green.

Live Convai acceptance remains environment-dependent on the configured Convai account, character mapping, credentials and any provider-side localhost/origin requirements. No workaround or security bypass is included.


## Single-runtime Convai integration

The frontend now uses the installed `@convai/web-sdk@1.7.0` `ConvaiClient` as the only
authoritative conversational runtime.

The startup path is:

```text
POST /v1/client/session/bootstrap
        ↓
POST /v1/session/start
        ↓
backend Dynamic Context
        ↓
POST /v1/convai/auth/token
        ↓
new ConvaiClient()
        ↓
connect()
        ↓
updateDynamicInfo(context.text)
        ↓
READY / LISTENING
        ↓
sendUserTextMessage() / microphone
        ↓
same ConvaiClient message events
        ↓
POST /v1/session/end
```

The frontend computes a short SHA-256 fingerprint of the exact Dynamic Context text
for development diagnostics. The semantic text itself is not transformed or retrieved
again by the browser.

### Pixel Streaming decision

`@convai/experience-embed` / `PixelStreamClient` was removed from the authoritative
conversation startup path.

The current Convai Pixel Streaming documentation exposes experience lifecycle and
media controls, but does not document a supported API for binding a published
Experience ID to an existing Web SDK `ConvaiClient` session or for injecting the
frontend's backend-generated Dynamic Context into that same Pixel Streaming
conversation. The Web SDK documentation instead identifies `ConvaiClient` as the
runtime managing the conversation and its audio/video controls, while custom UIs
use `AudioRenderer` for bot audio.

Therefore keeping Pixel Streaming as a second active conversation would violate the
integration requirement. It is intentionally not started by the UI. The current
authoritative test UI uses the Web SDK conversation and audio runtime rather than
claiming that a separate published Experience is grounded by the backend context.

This is a correctness decision, not a provider workaround: no unsupported session
bridge, duplicate conversation, frontend RAG, or backend change was introduced.
