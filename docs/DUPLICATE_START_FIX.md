# Duplicate Start/Turn Fix

The direct-conversation test UI now guards the Start action with a synchronous ref lock.

Why: React state changes are asynchronous. A rapid double-click on **Start conversation** could enter the startup handler twice before `uiState` changed from `IDLE`, causing duplicate bootstrap/direct-conversation requests and duplicate transcript turns.

Behavior now:

- Only one startup pipeline can run for a conversation lifecycle.
- The first completed message is submitted exactly once by Start.
- The active session is then reused for later questions.
- The startup lock is released when the startup fails or when the conversation is ended/reset.
- Existing turn IDs remain the presentation pairing mechanism.
- No backend change is required for this UI bug.

The fix is client-side only; it does not alter the backend conversation/session behavior.
