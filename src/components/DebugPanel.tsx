import type { Diagnostics } from '../types/conversation';

export function DebugPanel({ diagnostics }: { diagnostics: Diagnostics }) {
  const rows = [
    ['Backend', diagnostics.backend],
    ['Bootstrap', diagnostics.bootstrap],
    ['Session', diagnostics.sessionStart],
    ['Dynamic Context', diagnostics.context],
    ['Context applied', diagnostics.contextApplied],
    ['Diagnostics source', diagnostics.diagnosticsSource],
    ['Context fingerprint', diagnostics.contextFingerprint ?? '—'],
    ['Memory', diagnostics.memoryCount ?? '—'],
    ['Narrative', diagnostics.narrativeCount ?? '—'],
    ['Knowledge', diagnostics.knowledgeCount ?? '—'],
    ['Selected', diagnostics.selectedCount ?? '—'],
    ['Dropped', diagnostics.droppedCount ?? '—'],
    ['Context tokens', diagnostics.contextTokens ?? '—'],
    ['Question refreshes', diagnostics.contextRefreshes],
    ['Last question', diagnostics.lastQuestion ?? '—'],
    ['Convai auth', diagnostics.convaiAuth],
    ['Convai', diagnostics.convai],
    ['Conversation runtime', diagnostics.conversationRuntime],
    ['Transcript', diagnostics.transcript],
    ['Messages', diagnostics.messageCount],
    ['Startup ms', diagnostics.startupMs ?? '—'],
  ] as const;

  return (
    <details className="panel debug-panel">
      <summary>Development diagnostics</summary>
      <div className="debug-grid">
        {rows.map(([label, value]) => (
          <div className="debug-row" key={label}>
            <span>{label}</span>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>
      <p className="debug-note">Diagnostics are shown only from the latest backend conversation response with explicit diagnostics enabled. The UI never derives or fabricates counts or fingerprints; missing backend diagnostics are shown as —. Tokens, keys, internal IDs, provenance and raw backend exceptions are intentionally hidden.</p>
    </details>
  );
}
