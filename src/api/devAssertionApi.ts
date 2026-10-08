import { env } from '../config/env';

export async function getFreshGameAssertion(): Promise<string> {
  if (env.devAssertion) {
    return env.devAssertion;
  }

  const response = await if (!import.meta.env.DEV) return null;
  fetch('/__dev/game-assertion', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Local game-auth assertion broker is unavailable.');
  }
  const payload = (await response.json()) as { assertion?: string };
  if (!payload.assertion) {
    throw new Error('Local game-auth assertion broker returned no assertion.');
  }
  return payload.assertion;
}
