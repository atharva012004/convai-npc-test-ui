import { env } from '../config/env';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string;

  constructor(message: string, status: number, requestId: string, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.code = code;
  }
}

function createRequestId(): string {
  return crypto.randomUUID();
}

function publicApiPath(path: string): string {
  // In Vite development, always use the same-origin proxy. This is required
  // when the UI is opened through an HTTPS ngrok URL: the browser must not
  // fetch http://localhost:8000 directly, which would trigger CORS/preflight
  // failures and would not reach the backend through the public origin.
  if (import.meta.env.DEV) {
    return `/__backend${path}`;
  }
  return `${env.backendUrl.replace(/\/$/, '')}${path}`;
}

async function parseError(response: Response, requestId: string): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Ignore non-JSON error bodies.
  }

  if (payload && typeof payload === 'object') {
    const data = payload as { detail?: unknown; error?: { message?: unknown; code?: unknown } };
    const message = typeof data.detail === 'string'
      ? data.detail
      : typeof data.error?.message === 'string'
        ? data.error.message
        : `Backend request failed with HTTP ${response.status}.`;
    const code = typeof data.error?.code === 'string' ? data.error.code : null;
    return new ApiError(message, response.status, requestId, code);
  }

  return new ApiError(`Backend request failed with HTTP ${response.status}.`, response.status, requestId);
}

export async function requestJson<T>(
  path: string,
  options: {
    method: 'GET' | 'POST';
    body?: unknown;
    bearerToken?: string;
    gameAssertion?: string;
    extraHeaders?: Record<string, string>;
    signal?: AbortSignal;
    requestId?: string;
  },
): Promise<T> {
  const requestId = options.requestId ?? createRequestId();
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  });

  if (options.bearerToken) {
    headers.set('Authorization', `Bearer ${options.bearerToken}`);
  }
  if (options.gameAssertion) {
    headers.set('X-Client-ID', env.clientId);
    headers.set('X-Game-Assertion', options.gameAssertion);
  }
  if (options.extraHeaders) {
    for (const [key, value] of Object.entries(options.extraHeaders)) headers.set(key, value);
  }

  const response = await fetch(publicApiPath(path), {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw await parseError(response, requestId);
  }

  return (await response.json()) as T;
}


export async function requestBinary(
  path: string,
  options: {
    method: 'GET';
    bearerToken?: string;
    gameAssertion?: string;
    extraHeaders?: Record<string, string>;
    signal?: AbortSignal;
    requestId?: string;
  },
): Promise<ArrayBuffer> {
  const requestId = options.requestId ?? createRequestId();
  const headers = new Headers({
    Accept: 'audio/wav,application/octet-stream',
    'X-Request-ID': requestId,
  });

  if (options.bearerToken) {
    headers.set('Authorization', `Bearer ${options.bearerToken}`);
  }
  if (options.gameAssertion) {
    headers.set('X-Client-ID', env.clientId);
    headers.set('X-Game-Assertion', options.gameAssertion);
  }
  if (options.extraHeaders) {
    for (const [key, value] of Object.entries(options.extraHeaders)) headers.set(key, value);
  }

  const response = await fetch(publicApiPath(path), {
    method: options.method,
    headers,
    signal: options.signal,
  });

  if (!response.ok) {
    throw await parseError(response, requestId);
  }

  return response.arrayBuffer();
}
