import { env } from '../config/env';

export async function getFreshGameAssertion(): Promise<string> {
  if (env.devAssertion) {
    return env.devAssertion;
  }

  // The local assertion broker exists only in the Vite development server.
  // A Vercel production build must not request /__dev/game-assertion.
  if (!import.meta.env.DEV) {
    throw new Error(
      'Game-auth assertion is not configured for this production deployment. Set the VITE_DEV_ASSERTION environment variable in Vercel.'
    );
  }

  const response = await fetch('/__dev/game-assertion', {
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
