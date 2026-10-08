function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

export const env = {
  backendUrl: required('VITE_BACKEND_URL', import.meta.env.VITE_BACKEND_URL),
  clientId: required('VITE_CLIENT_ID', import.meta.env.VITE_CLIENT_ID),
  characterExternalId: required('VITE_CHARACTER_EXTERNAL_ID', import.meta.env.VITE_CHARACTER_EXTERNAL_ID),
  actorExternalId: required('VITE_ACTOR_EXTERNAL_ID', import.meta.env.VITE_ACTOR_EXTERNAL_ID),
  devAssertion: import.meta.env.VITE_GAME_ASSERTION?.trim() || '',
  frontendPort: import.meta.env.VITE_FRONTEND_PORT?.trim() || '3000',
  // Public Convai experience ID used by the local Elizabeth visual test. It is not a secret.
  // Keep the env override so the UI remains reusable with another published experience.
  convaiExperienceId:
    import.meta.env.VITE_CONVAI_EXPERIENCE_ID?.trim() ||
    '84b5c0f3-02dd-48cc-a54b-77094cb6f422',
} as const;
