export function parseExpiration(value: string): number | null {
  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }

  // Convai returns ISO timestamps without an explicit timezone in some token
  // responses. Treat timezone-less ISO date-times as UTC instead of the
  // browser's local timezone.
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
  const normalized = /T/.test(trimmed) && !hasExplicitTimezone ? `${trimmed}Z` : trimmed;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
