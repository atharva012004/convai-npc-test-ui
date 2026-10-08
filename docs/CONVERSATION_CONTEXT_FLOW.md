# Conversation Context Flow

## Purpose

The UI treats the backend Dynamic Context as authoritative, but it does not
require that context to contain text for every conversational turn.

An empty context is a valid result. This is expected when the backend's
conversation gate decides that a message such as a greeting or small talk does
not require PageIndex knowledge retrieval and no memory/narrative is relevant.

## Runtime flow

```text
actor message
    ↓
POST /v1/session/context/refresh
    ↓
backend conversation/knowledge gate
    ↓
knowledge required? ── yes ──> existing PageIndex pipeline
    │
    no
    ↓
empty Dynamic Context
    ↓
UI applies reset to Convai runtime context
    ↓
UI sends the original actor message to the same ConvaiClient
```

## Important invariants

- HTTP 200 + `dynamic_context.status = empty` is **not** a refresh failure.
- A valid empty context must clear any previous temporary Convai context so
  knowledge from an earlier question cannot leak into a greeting or casual turn.
- A missing Dynamic Context object, or a `failed`/`cancelled` context status,
  remains an actual integration error.
- Non-empty backend context replaces the previous temporary Convai context.
- Context updates are silent (`run_llm = false`); the actor message is the only
  operation that asks Convai to answer.
- The UI does not classify knowledge intent and does not call PageIndex.
  The backend remains responsible for that decision.
- Authentication, session binding, Memory, Narrative, PageIndex and Context
  Intelligence remain backend-owned.

## Convai SDK detail

The SDK's legacy `updateDynamicInfo('')` is a no-op, so it cannot clear a
previous runtime context. The UI therefore uses the SDK's unified
`updateContext()` API:

- non-empty context: `mode: "replace"`
- empty context: `mode: "reset"`
- both: `run_llm: "false"`

This prevents stale knowledge from a previous question from remaining active
while allowing normal conversation to continue when the current backend
context is intentionally empty.
