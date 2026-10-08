# Accurate UI diagnostics fix

The diagnostics panel is now explicitly tied to the latest conversation request.

Changes:
- Clears the previous diagnostics snapshot when a new question starts.
- Uses the latest backend response runtime snapshot when available.
- Accepts either `runtime`, `diagnostics`, or a returned `context.dynamic_context` shape.
- Never substitutes zero or a locally-generated empty-context fingerprint for missing backend diagnostics.
- Shows `—` when the backend did not return a field, so stale data cannot masquerade as current backend state.
- Shows `Diagnostics source = backend-response` when the values are backed by the latest API response.

Important:
The browser cannot read the Uvicorn server's internal logs. Therefore exact values such as
the backend log's `selected_count=4` can only be displayed automatically if `/v1/conversation`
returns that diagnostic snapshot in its JSON response. If the endpoint only logs those values
server-side, the frontend correctly displays them as unavailable rather than inventing them.
