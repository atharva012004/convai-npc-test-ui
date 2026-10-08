import { requestJson } from './backendClient';
import type { ConvaiTokenResponse } from '../types/backend';

export function getConvaiToken(
  token: string,
  characterExternalId: string,
  actorExternalId: string,
  signal?: AbortSignal,
): Promise<ConvaiTokenResponse> {
  return requestJson<ConvaiTokenResponse>('/v1/convai/auth/token', {
    method: 'POST',
    bearerToken: token,
    body: {
      character_external_id: characterExternalId,
      actor_external_id: actorExternalId,
    },
    signal,
  });
}
