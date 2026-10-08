# Elizabeth / Convai Runtime Integration

## Current authoritative runtime

The test UI now uses one `@convai/web-sdk@1.7.0` `ConvaiClient` as the sole
conversation runtime.

The backend-generated Dynamic Context is applied to that exact client before the UI
allows conversation.

```text
Backend Dynamic Context
        ↓
same ConvaiClient
        ↓
same audio/conversation session
        ↓
same transcript events
```

## Published Experience ID

The project may still keep:

```text
VITE_CONVAI_EXPERIENCE_ID=84b5c0f3-02dd-48cc-a54b-77094cb6f422
```

for reference, but the UI does not start that published Pixel Streaming Experience
during the authoritative backend test.

## Why Pixel Streaming is not started

The published Experience and the Web SDK `ConvaiClient` are separate provider
runtime concepts. The current Pixel Streaming embed API documents experience
initialization, audio/camera controls and session fetching, but does not document a
supported method to bind the published Experience to an already authenticated
`ConvaiClient` conversation or inject the backend's Dynamic Context into that exact
Pixel Streaming session.

Starting it alongside the Web SDK would therefore recreate the original defect:
two independent Convai conversations.

The corrected UI intentionally refuses to make that unsupported claim.

## Visual implication

The Web SDK is authoritative for this integration test. Its documented custom UI path
provides the character conversation, audio playback and lipsync data; the SDK's
`enableVideo` option is for browser video/screen-share input, not a documented
published-avatar Pixel Streaming renderer.

If a future Convai SDK release provides an official shared-session bridge or an
authoritative character-video renderer tied to the same `ConvaiClient`, it can be
added without changing the backend Dynamic Context pipeline.
