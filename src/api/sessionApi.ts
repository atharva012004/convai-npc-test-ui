import { requestJson } from './backendClient';
import type { BootstrapResponse, SessionEndResponse, SessionStartResponse } from '../types/backend';

export function bootstrapSessionForIdentity(
  assertion: string,
  characterExternalId: string,
  actorExternalId: string,
  sessionId?: string | null,
  signal?: AbortSignal,
): Promise<BootstrapResponse> {
  return requestJson<BootstrapResponse>('/v1/client/session/bootstrap', {
    method: 'POST',
    gameAssertion: assertion,
    body: {
      character_external_id: characterExternalId,
      actor_external_id: actorExternalId,
      ...(sessionId ? { session_id: sessionId } : {}),
    },
    signal,
  });
}

export function startSession(
  token: string,
  characterExternalId: string,
  actorExternalId: string,
  knowledgeQuery: string,
  signal?: AbortSignal,
): Promise<SessionStartResponse> {
  return requestJson<SessionStartResponse>('/v1/session/start', {
    method: 'POST',
    bearerToken: token,
    body: {
      character_external_id: characterExternalId,
      actor_external_id: actorExternalId,
      knowledge_query: knowledgeQuery.trim() || null,
    },
    signal,
  });
}

export interface SessionContextRefreshResponse {
  session_id: string;
  context: SessionStartResponse['context'];
}

export function refreshSessionContext(
  token: string,
  sessionId: string,
  knowledgeQuery: string,
  signal?: AbortSignal,
): Promise<SessionContextRefreshResponse> {
  return requestJson<SessionContextRefreshResponse>('/v1/session/context/refresh', {
    method: 'POST',
    bearerToken: token,
    body: { session_id: sessionId, knowledge_query: knowledgeQuery.trim() },
    signal,
  });
}

export function getSessionTranscript(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<import('../types/backend').BackendTranscript> {
  return requestJson<import('../types/backend').BackendTranscript>(`/v1/conversation/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    bearerToken: token,
    signal,
  });
}

export function endSession(
  token: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return requestJson<boolean>('/v1/session/end', {
    method: 'POST',
    bearerToken: token,
    body: { session_id: sessionId },
    signal,
  });
}
