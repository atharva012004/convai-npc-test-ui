> **SUPERSEDED:** This report describes the pre-question-refresh runtime. See `QUESTION_GROUNDING_FIX.md` for the current architecture.

# Frontend Convai Runtime Integration Validation Report

Date: 2026-08-26

## 1. Root cause

The previous UI created two independent Convai runtime sessions:

- `useConversation.ts` created `ConvaiClient` and applied backend Dynamic Context.
- `NpcPanel.tsx` created `PixelStreamClient` for the published Experience ID.

The Start button started both. Therefore the session receiving Dynamic Context was not provably the same session as the published visual Experience.

## 2. Files modified

- `src/hooks/useConversation.ts`
- `src/convai/convaiClient.ts`
- `src/components/NpcPanel.tsx`
- `src/components/ConversationPanel.tsx` (presentation remains compatible with normalized turns)
- `src/components/DebugPanel.tsx`
- `src/App.tsx`
- `src/api/backendClient.ts`
- `src/state/convaiMessagePresentation.ts`
- `src/state/convaiMessagePresentation.test.ts`
- `src/types/conversation.ts`
- `src/styles.css`
- `vite.config.ts`
- `.env.example`
- `FINAL_ENV_TEMPLATE.env`
- `README.md`
- `docs/INTEGRATION_AUDIT.md`
- `docs/FINAL_FIX_NOTES.md`
- `docs/Elizabeth_VISUAL_INTEGRATION.md`

## 3. Old architecture

```text
Backend Dynamic Context
       ↓
ConvaiClient A
       ↓
updateDynamicInfo()

Published Experience
       ↓
PixelStreamClient B
```

The two sessions had no supported shared-session bridge.

## 4. New architecture

```text
Backend bootstrap
       ↓
Backend session/start
       ↓
Memory / Narrative / PageIndex / Context Intelligence
       ↓
Dynamic Context
       ↓
Convai auth
       ↓
ONE ConvaiClient
       ↓
connect()
       ↓
updateDynamicInfo()
       ↓
same microphone/text runtime
       ↓
same message events
       ↓
same UI transcript
       ↓
session/end
```

## 5. Dynamic Context generation

The backend remains responsible for generating:

`startedSession.context.dynamic_context`

The frontend does not retrieve, rank, summarize, or regenerate knowledge.

## 6. Dynamic Context application

The exact `context.text` is passed to:

`applyDynamicContext(client, context.text)`

which calls:

`client.updateDynamicInfo(dynamicContextText)`

No frontend transformation is performed.

The UI now requires:

- `context.status === "complete"`
- non-empty `context.text`
- successful `updateDynamicInfo()`

before entering `READY`.

## 7. Runtime identity

The Convai character ID comes only from:

`convaiToken.convai_character_id`

and the end-user ID comes only from:

`convaiToken.end_user_id`.

The frontend no longer uses the published Experience ID to create another conversational runtime.

## 8. PixelStreamClient

Removed from `src/`.

There is no `new PixelStreamClient()`, `initializeExperience()`, or Pixel Streaming
session startup in the conversation path.

This is deliberate because the current supported Pixel Streaming API does not document
a bridge to the existing Web SDK conversation or a method to inject this backend
Dynamic Context into that same Pixel Streaming session.

## 9. Start lifecycle

```text
Start Conversation
 → fresh game assertion
 → /v1/client/session/bootstrap
 → /v1/session/start
 → validate complete Dynamic Context
 → fingerprint exact context text
 → /v1/convai/auth/token
 → create one ConvaiClient
 → connect
 → updateDynamicInfo(exact context text)
 → contextApplied = YES
 → READY
 → microphone enabled
```

## 10. End lifecycle

```text
Stop
 → disconnect same ConvaiClient
 → normalize transcript from same client
 → /v1/session/end
 → clear runtime state
 → COMPLETED
```

## 11. Context fingerprint

A short SHA-256 fingerprint is calculated from the exact Dynamic Context text and shown
in development diagnostics. This provides a safe way to correlate the active frontend
context with backend session logs without exposing the context or secrets.

## 12. Presentation fix

The transcript now:

- collapses cumulative user STT revisions into one actor turn;
- aggregates bot LLM streaming chunks into one NPC message;
- replaces the streamed draft with final `bot-transcription`;
- keeps already-rendered partial output if the user interrupts;
- rejects late chunks from an interrupted response;
- ignores `user-llm-text` and unrelated transport noise.

## 13. ngrok/CORS fix

The previous browser error happened because the ngrok page was making requests directly
to `http://localhost:8000`.

During Vite development, backend requests now always use:

`/__backend/...`

through the Vite same-origin proxy, regardless of the browser hostname.

The Vite dev server also allows `.ngrok-free.dev`.

## 14. Static runtime audit

Result:

```text
createConvaiClient / new ConvaiClient:
ONE authoritative creation path

PixelStreamClient / experience-embed:
ZERO source-code references

updateDynamicInfo:
ONE runtime application path
```

## 15. Automated checks possible in this environment

TypeScript/TSX transpilation audit:

```text
30 files checked
0 transpilation diagnostics
PASS
```

Presentation behavior smoke tests:

```text
actor cumulative STT collapse: PASS
NPC streaming aggregation: PASS
final NPC transcription replacement: PASS
```

Package JSON validation:

```text
PASS
```

## 16. npm test/build/lint limitation

The uploaded project does not contain `node_modules`.

A local `npm install --offline` was attempted, but the environment has no cached
`@convai/web-sdk@1.7.0` package and cannot access the npm registry from the build
environment. Therefore:

```text
npm test       NOT EXECUTED — dependencies unavailable
npm run build  NOT EXECUTED — dependencies unavailable
npm run lint   NOT EXECUTED — dependencies unavailable
```

The user's local environment should run:

```text
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

## 17. Backend tests

The backend source tree is not part of the uploaded UI ZIP, so:

```text
pytest -q
python -m compileall -q app tests scripts
```

could not be executed from this frontend artifact.

No backend files were modified.

## 18. Browser acceptance

A live browser session against the user's Convai account/backend cannot be executed
from this artifact-generation environment.

The code is prepared for the required browser test, but it would be incorrect to
claim that the live Convai response was verified here.

## 19. Required knowledge tests

Use these after starting the backend and UI:

1. `What are the main features of HeyGen LiveAvatar?`
2. `What does HeyGen LiveAvatar Lite mode handle, and what does our backend need to handle for the voice pipeline?`
3. `Which APIs are used to create and start a HeyGen LiveAvatar session, and what credentials are returned to the frontend?`
4. `What are the differences between the Free, Starter, Essential and Business LiveAvatar plans?`
5. Unsupported: `What is HeyGen's internal 2027 infrastructure roadmap?`

For each test, compare:

- backend Dynamic Context status;
- context fingerprint;
- `Context applied = YES`;
- Convai runtime = `single-convai-client`;
- answer against the actual backend Dynamic Context.

## 20. Important final limitation

The one requirement that cannot honestly be claimed as satisfied by this frontend is:

`same backend-grounded ConvaiClient + published Pixel Streaming Elizabeth video in one shared provider session`.

The currently documented Pixel Streaming API does not provide the required shared-session
bridge. The implementation therefore chooses the required correctness property over
an unsupported fake integration: there is one authoritative Convai conversation, and
the published Pixel Streaming runtime is not started as a second conversation.

No backend, PageIndex, Memory, Narrative, Context Intelligence, Dynamic Context,
authentication, or session architecture was redesigned.

## 21. Phase boundary

No Phase 9 work was started. This artifact is limited to the frontend Convai runtime integration and presentation fixes requested in this task.
