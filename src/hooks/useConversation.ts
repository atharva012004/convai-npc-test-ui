import { parseExpiration } from './expiration';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshGameAssertion } from '../api/devAssertionApi';
import { getConvaiToken } from '../api/convaiApi';
import { bootstrapSessionForIdentity, endSession, getSessionTranscript } from '../api/sessionApi';
import { getConversationAudio, sendDirectConversation } from '../api/directConversationApi';
import { env } from '../config/env';
import {
  connectConvai,
  createConvaiClient,
  disconnectConvai,
  interruptCurrentResponse,
  shouldInterruptForExplicitUserTurn,
  subscribeConvai,
  type ConvaiClientInstance,
} from '../convai/convaiClient';
import type { ConvaiMessageLike, ConvaiStateLike } from '../types/convai';
import type { SessionStartResponse } from '../types/backend';
import type { ConversationMessage, Diagnostics, UiState } from '../types/conversation';
import { appendConvaiMessage } from '../state/convaiMessagePresentation';
import { ApiError } from '../api/backendClient';

const STARTUP_DEADLINE_MS = 45_000;
const RECENT_DUPLICATE_WINDOW_MS = 4_000;

const LAST_SESSION_STORAGE_KEY = 'convai-npc-test:last-session';
type SessionMode = 'new' | 'resume';

interface StoredSessionReference {
  sessionId: string;
  characterExternalId: string;
  actorExternalId: string;
  savedAt: string;
}

function readStoredSessionReference(): StoredSessionReference | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSessionReference>;
    if (!parsed.sessionId || !parsed.characterExternalId || !parsed.actorExternalId) return null;
    if (parsed.characterExternalId !== env.characterExternalId || parsed.actorExternalId !== env.actorExternalId) return null;
    return {
      sessionId: parsed.sessionId,
      characterExternalId: parsed.characterExternalId,
      actorExternalId: parsed.actorExternalId,
      savedAt: parsed.savedAt || '',
    };
  } catch {
    return null;
  }
}

function writeStoredSessionReference(sessionId: string): void {
  try {
    localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify({
      sessionId,
      characterExternalId: env.characterExternalId,
      actorExternalId: env.actorExternalId,
      savedAt: new Date().toISOString(),
    } satisfies StoredSessionReference));
  } catch {
    // Session continuation remains backend-authoritative; storage is only the UI selector.
  }
}


function safeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Backend authentication expired or was rejected. Start a fresh conversation.';
    if (error.status === 403) return 'The current actor/character is not authorized for this backend session.';
    if (error.status === 429) return 'The backend rate limit was reached. Wait briefly and try again.';
    if (error.status >= 500) return 'The backend is temporarily unavailable. Check the backend logs and try again.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'The conversation could not be processed.';
}

export function useConversation() {
  const [uiState, setUiState] = useState<UiState>('IDLE');
  const [sessionMode, setSessionMode] = useState<SessionMode>('new');
  const [previousSession, setPreviousSession] = useState<StoredSessionReference | null>(() => readStoredSessionReference());
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [session, setSession] = useState<SessionStartResponse | null>(null);
  const [convaiClient, setConvaiClient] = useState<ConvaiClientInstance | null>(null);
  const [convaiCharacterId, setConvaiCharacterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcriptSaveMessage, setTranscriptSaveMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({
    backend: 'unknown', bootstrap: 'idle', sessionStart: 'idle', context: 'idle', contextApplied: 'no',
    contextFingerprint: null, convaiAuth: 'idle', convai: 'idle', transcript: 'idle', startupMs: null,
    messageCount: 0, memoryCount: null, narrativeCount: null, knowledgeCount: null, selectedCount: null,
    droppedCount: null, contextTokens: null, diagnosticsSource: 'unavailable', contextRefreshes: 0, lastQuestion: null,
    conversationRuntime: 'not-started',
  });

  const clientRef = useRef<ConvaiClientInstance | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const backendTokenRef = useRef<string | null>(null);
  const backendTokenExpiresAtRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<ConversationMessage[]>([]);
  const lifecycleIdRef = useRef(0);
  const questionInFlightRef = useRef(false);
  const stoppingRef = useRef(false);
  const contextAppliedRef = useRef(false);
  const currentActorTurnIdRef = useRef<string | null>(null);
  const activeNpcResponseActorIdRef = useRef<string | null>(null);
  const responseStartedForCurrentActorRef = useRef(false);
  const recentSubmissionRef = useRef<{ key: string; at: number } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    transcriptRef.current = messages;
    setDiagnostics((current) => ({ ...current, messageCount: messages.length }));
  }, [messages]);

  const stopConvaiAudio = useCallback(() => {
    const source = audioSourceRef.current;
    audioSourceRef.current = null;
    if (source) {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* best-effort cleanup */ }
    }
  }, []);

  const playConvaiAudio = useCallback(async (audioData: ArrayBuffer): Promise<void> => {
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    stopConvaiAudio();

    const audioBuffer = await context.decodeAudioData(audioData.slice(0));
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    audioSourceRef.current = source;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (audioSourceRef.current === source) audioSourceRef.current = null;
        resolve();
      };
      source.start(0);
    });
  }, [stopConvaiAudio]);

  const clearConvai = useCallback(async () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const client = clientRef.current;
    clientRef.current = null;
    setConvaiClient(null);
    if (client) {
      try { await disconnectConvai(client); } catch { /* best-effort cleanup */ }
    }
  }, []);

  const resetRuntime = useCallback(() => {
    setMessages([]);
    setSession(null);
    setError(null);
    setTranscriptSaveMessage(null);
    backendTokenRef.current = null;
    backendTokenExpiresAtRef.current = null;
    sessionIdRef.current = null;
    questionInFlightRef.current = false;
    contextAppliedRef.current = false;
    currentActorTurnIdRef.current = null;
    activeNpcResponseActorIdRef.current = null;
    responseStartedForCurrentActorRef.current = false;
    recentSubmissionRef.current = null;
    setDiagnostics({
      backend: 'unknown', bootstrap: 'idle', sessionStart: 'idle', context: 'idle', contextApplied: 'no',
      contextFingerprint: null, convaiAuth: 'idle', convai: 'idle', transcript: 'idle', startupMs: null,
      messageCount: 0, memoryCount: 0, narrativeCount: 0, knowledgeCount: 0, selectedCount: 0,
      droppedCount: 0, contextTokens: null, diagnosticsSource: 'unavailable', contextRefreshes: 0, lastQuestion: null,
      conversationRuntime: 'not-started',
    });
  }, []);

  const start = useCallback(async (mode: SessionMode = sessionMode) => {
    if (uiState !== 'IDLE' && uiState !== 'COMPLETED' && uiState !== 'ERROR') return;
    const lifecycleId = ++lifecycleIdRef.current;
    stoppingRef.current = false;
    try {
      audioContextRef.current = audioContextRef.current ?? new AudioContext();
      if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume();
    } catch {
      // Playback will surface an error if the browser blocks audio.
    }
    await clearConvai();
    resetRuntime();
    setUiState('STARTING_BACKEND_SESSION');

    const startedAt = performance.now();
    const controller = new AbortController();
    const stored = mode === 'resume' ? readStoredSessionReference() : null;
    if (mode === 'resume' && !stored) {
      setError('There is no previous session available to continue.');
      setUiState('ERROR');
      return;
    }
    const deadline = window.setTimeout(() => controller.abort(), STARTUP_DEADLINE_MS);

    try {
      const assertion = await getFreshGameAssertion();
      const bootstrap = await bootstrapSessionForIdentity(
        assertion,
        env.characterExternalId,
        env.actorExternalId,
        stored?.sessionId ?? null,
        controller.signal,
      );
      if (lifecycleId !== lifecycleIdRef.current) return;
      backendTokenRef.current = bootstrap.access_token;
      backendTokenExpiresAtRef.current = bootstrap.expires_at * 1000;
      if (mode === 'resume' && stored) {
        try {
          const transcript = await getSessionTranscript(bootstrap.access_token, stored.sessionId, controller.signal);
          const restoredMessages: ConversationMessage[] = transcript.turns.flatMap((turn, index) => [{
            id: `restored-${index}-${turn.timestamp ?? 'unknown'}`,
            speaker: turn.role === 'user' ? 'actor' : 'npc',
            text: turn.content,
            timestamp: turn.timestamp ?? stored.savedAt ?? new Date().toISOString(),
          }]);
          setMessages(restoredMessages);
          transcriptRef.current = restoredMessages;
        } catch {
          // A transcript read is helpful for the UI but not required to resume the authoritative backend session.
          setMessages([]);
          transcriptRef.current = [];
        }
      }
      setDiagnostics((current) => ({
        ...current,
        backend: 'connected', bootstrap: 'success', sessionStart: 'idle',
        convaiAuth: 'pending', convai: 'initializing', transcript: 'collecting',
        startupMs: Math.round(performance.now() - startedAt),
      }));

      const convaiToken = await getConvaiToken(
        bootstrap.access_token,
        env.characterExternalId,
        env.actorExternalId,
        controller.signal,
      );
      if (lifecycleId !== lifecycleIdRef.current) return;
      const expirationMs = parseExpiration(convaiToken.expiration_time);
      if (expirationMs !== null && expirationMs <= Date.now()) throw new Error('The backend returned an already-expired Convai token.');
      setDiagnostics((current) => ({ ...current, convaiAuth: 'received' }));

      const client = createConvaiClient();
      clientRef.current = client;
      setConvaiClient(client);
      setConvaiCharacterId(convaiToken.convai_character_id);

      unsubscribeRef.current = subscribeConvai(client, {
        onStateChange: (state: ConvaiStateLike) => {
          if (lifecycleId !== lifecycleIdRef.current) return;
          if (state.isThinking || state.isSpeaking) responseStartedForCurrentActorRef.current = true;
          setDiagnostics((current) => ({
            ...current,
            convai: state.isConnected ? 'connected' : current.convai,
            conversationRuntime: state.isConnected ? 'single-convai-client' : current.conversationRuntime,
          }));
          if (questionInFlightRef.current) return;
          if (state.isSpeaking) setUiState('NPC_SPEAKING');
          else if (state.isListening && contextAppliedRef.current) setUiState('LISTENING');
          else if (state.isConnected && contextAppliedRef.current) setUiState('READY');
        },
        onMessage: (incoming: ConvaiMessageLike) => {
          if (lifecycleId !== lifecycleIdRef.current || !incoming.content?.trim()) return;
          // The browser speech gate owns the final player line. Convai's user
          // transcription transport is intentionally ignored to prevent a
          // second visual turn for one question.
          if (incoming.type === 'user-transcription' || incoming.type === 'user-llm-text') return;
          if (incoming.type !== 'bot-llm-text' && incoming.type !== 'bot-transcription') return;
          const actorId = currentActorTurnIdRef.current;
          if (!actorId || !responseStartedForCurrentActorRef.current) return;
          if (activeNpcResponseActorIdRef.current === null) activeNpcResponseActorIdRef.current = actorId;
          if (activeNpcResponseActorIdRef.current !== actorId) return;
          setMessages((current) => appendConvaiMessage(current, incoming));
        },
        onUserTranscriptionChange: () => undefined,
        onError: (convaiError: Error) => {
          if (lifecycleId !== lifecycleIdRef.current) return;
          setDiagnostics((current) => ({ ...current, convai: 'error' }));
          setError(`Convai error: ${convaiError.message}`);
          setUiState('ERROR');
        },
      });

      setUiState('CONNECTING_CONVAI');
      await connectConvai(client, convaiToken.api_auth_token, convaiToken.convai_character_id, convaiToken.end_user_id);
      if (lifecycleId !== lifecycleIdRef.current) return;
      clearTimeout(deadline);
      setDiagnostics((current) => ({
        ...current,
        convai: 'connected',
        conversationRuntime: 'single-convai-client',
        startupMs: Math.round(performance.now() - startedAt),
      }));
      setUiState('READY');
    } catch (caughtError) {
      clearTimeout(deadline);
      if (lifecycleId !== lifecycleIdRef.current) return;
      setError(controller.signal.aborted ? 'Conversation startup exceeded the 45-second local startup deadline.' : safeErrorMessage(caughtError));
      setDiagnostics((current) => ({
        ...current,
        backend: current.bootstrap === 'success' ? current.backend : 'error',
        bootstrap: current.bootstrap === 'pending' ? 'error' : current.bootstrap,
        convaiAuth: current.convaiAuth === 'pending' ? 'error' : current.convaiAuth,
        convai: current.convai === 'connected' ? current.convai : 'error',
      }));
      setUiState('ERROR');
      await clearConvai();
    }
  }, [clearConvai, resetRuntime, sessionMode, uiState]);

  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    const client = clientRef.current;
    const token = backendTokenRef.current;
    // The unified backend endpoint is the authoritative conversation turn.
    // Convai is not called a second time for the same question.
    if (!trimmed || !token || questionInFlightRef.current) return;
    if (backendTokenExpiresAtRef.current !== null && backendTokenExpiresAtRef.current <= Date.now()) {
      setError('The backend session token has expired. Start a fresh conversation.');
      setUiState('ERROR');
      return;
    }
    const key = trimmed.replace(/\s+/g, ' ').toLocaleLowerCase();
    const now = Date.now();
    const recent = recentSubmissionRef.current;
    if (recent && recent.key === key && now - recent.at < RECENT_DUPLICATE_WINDOW_MS) return;
    recentSubmissionRef.current = { key, at: now };

    questionInFlightRef.current = true;
    setError(null);
    setUiState('REFRESHING_CONTEXT');
    // Clear the previous question's backend snapshot immediately. This prevents
    // the diagnostics panel from showing stale values while the new request is
    // being processed.
    setDiagnostics((current) => ({
      ...current,
      context: 'pending',
      contextApplied: 'no',
      contextFingerprint: null,
      memoryCount: null,
      narrativeCount: null,
      knowledgeCount: null,
      selectedCount: null,
      droppedCount: null,
      contextTokens: null,
      diagnosticsSource: 'unavailable',
      lastQuestion: trimmed,
    }));
    try {
      if (client && shouldInterruptForExplicitUserTurn(client.state)) {
        activeNpcResponseActorIdRef.current = null;
        responseStartedForCurrentActorRef.current = false;
        interruptCurrentResponse(client);
      }

      // This is the ONLY conversation-turn request. The backend creates/reuses
      // the session, loads memory, builds context, performs knowledge retrieval
      // when needed, generates the NPC answer, and persists both sides of the turn.
      const result = await sendDirectConversation(
        token,
        env.characterExternalId,
        env.actorExternalId,
        trimmed,
      );
      if (!sessionIdRef.current) sessionIdRef.current = result.session_id;
      writeStoredSessionReference(result.session_id);
      setPreviousSession(readStoredSessionReference());

      const runtime = result.runtime;
      if (runtime?.context_status === 'failed' || runtime?.context_status === 'cancelled') {
        throw new Error(`Backend Dynamic Context is ${runtime.context_status}; the conversation turn was not completed.`);
      }

      const dynamicContext = {
        status: (runtime?.context_status ?? 'complete') as 'complete' | 'partial' | 'empty' | 'failed' | 'cancelled',
        memory: [], narrative: [], knowledge: [], policy_version: null,
        selected_count: runtime?.selected_count ?? 0,
        dropped_count: runtime?.dropped_count ?? 0,
        conflict_groups: [],
        budget_usage: { selected_tokens: runtime?.context_tokens ?? 0 },
        metadata: {},
        text: runtime?.dynamic_context_text ?? '',
      };
      const nowIso = new Date().toISOString();
      setSession((current) => current ?? ({
        id: result.session_id,
        character_id: '', actor_id: '', status: 'active', started_at: nowIso,
        context: {
          project: { id: '', name: 'Direct conversation' },
          character: { id: '', external_id: env.characterExternalId, convai_character_id: convaiCharacterId, base_personality: null, config: {} },
          actor: { id: '', external_id: env.actorExternalId, meta: {} }, relationship: null, narrative: null,
          knowledge: null, memory: null, session: { id: result.session_id, status: 'active', started_at: nowIso, ended_at: null },
          dynamic_context: dynamicContext,
        },
      }));
      setSession((current) => current ? { ...current, status: 'active', context: { ...current.context, dynamic_context: dynamicContext } } : current);

      const actorTurnId = `actor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const actorTurn: ConversationMessage = {
        id: actorTurnId,
        speaker: 'actor', text: trimmed, timestamp: nowIso,
      };
      currentActorTurnIdRef.current = actorTurnId;
      activeNpcResponseActorIdRef.current = actorTurnId;
      responseStartedForCurrentActorRef.current = true;
      setMessages((current) => [...current, actorTurn]);

      setDiagnostics((current) => ({
        ...current,
        backend: 'connected', sessionStart: 'success', lastQuestion: trimmed,
        context: runtime?.context_status === 'complete' ? 'complete' : runtime?.context_status === 'partial' ? 'partial' : runtime?.context_status === 'empty' ? 'empty' : 'complete',
        contextApplied: 'yes',
        contextFingerprint: runtime?.context_fingerprint ?? null,
        memoryCount: runtime?.memory_count ?? null,
        narrativeCount: runtime?.narrative_count ?? null,
        knowledgeCount: runtime?.knowledge_count ?? null,
        selectedCount: runtime?.selected_count ?? null,
        droppedCount: runtime?.dropped_count ?? null,
        contextTokens: runtime?.context_tokens ?? null,
        diagnosticsSource: runtime ? 'backend-response' : 'unavailable',
        contextRefreshes: current.contextRefreshes + 1, conversationRuntime: 'single-backend-api',
      }));

      // The public /v1/conversation response intentionally does not expose
      // Convai audio bytes. The backend stores the exact audio generated by
      // Convai under this turn's X-Request-ID. Fetch that binary audio now.
      // Never send the question to the browser Convai SDK: doing so would
      // create a second AI turn.
      setUiState('NPC_SPEAKING');
      const npcTurn: ConversationMessage = {
        id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        speaker: 'npc', text: result.response, timestamp: new Date().toISOString(),
      };
      setMessages((current) => [...current, npcTurn]);

      try {
        const audio = await getConversationAudio(token, result.request_id);
        await playConvaiAudio(audio);
      } catch (audioError) {
        // Voice delivery must not invalidate a successfully generated text turn.
        // Surface the failure in the console so the backend/audio endpoint can
        // be diagnosed without falsely reporting transcript/conversation failure.
        console.error('[Convai voice] audio delivery/playback failed', audioError);
      }
      setUiState('READY');
    } catch (caughtError) {
      setError(safeErrorMessage(caughtError));
      setUiState('ERROR');
    } finally {
      questionInFlightRef.current = false;
    }
  }, [convaiCharacterId, playConvaiAudio, stopConvaiAudio]);

  const interruptForExplicitUserTurn = useCallback(() => {
    const client = clientRef.current;
    if (!client || !client.state.isConnected || !shouldInterruptForExplicitUserTurn(client.state)) return false;
    stopConvaiAudio();
    activeNpcResponseActorIdRef.current = null;
    responseStartedForCurrentActorRef.current = false;
    interruptCurrentResponse(client);
    return true;
  }, [stopConvaiAudio]);

  const stop = useCallback(async () => {
    if (stoppingRef.current) return;
    if (!sessionIdRef.current && !clientRef.current) { setUiState('COMPLETED'); return; }
    stoppingRef.current = true;
    stopConvaiAudio();
    const lifecycleId = ++lifecycleIdRef.current;
    setUiState('STOPPING');
    setError(null);
    setDiagnostics((current) => ({ ...current, transcript: 'saving' }));
    await clearConvai();
    const token = backendTokenRef.current;
    const sessionId = sessionIdRef.current;
    if (token && sessionId) {
      try {
        const response = await endSession(token, sessionId);
        if (lifecycleId !== lifecycleIdRef.current) return;
        if (!response) throw new Error('The backend did not confirm that the session was ended.');
        setDiagnostics((current) => ({ ...current, transcript: 'saved' }));
        setTranscriptSaveMessage('Transcript saved and backend memory processing completed.');
      } catch (caughtError) {
        if (lifecycleId !== lifecycleIdRef.current) return;
        setDiagnostics((current) => ({ ...current, transcript: 'error' }));
        setError(`Transcript persistence failed: ${safeErrorMessage(caughtError)}`);
      }
    }
    sessionIdRef.current = null;
    backendTokenRef.current = null;
    backendTokenExpiresAtRef.current = null;
    questionInFlightRef.current = false;
    contextAppliedRef.current = false;
    setUiState('COMPLETED');
    stoppingRef.current = false;
  }, [clearConvai]);

  const reset = useCallback(async () => {
    lifecycleIdRef.current += 1;
    await clearConvai();
    resetRuntime();
    setConvaiCharacterId(null);
    setUiState('IDLE');
  }, [clearConvai, resetRuntime]);

  useEffect(() => () => {
    lifecycleIdRef.current += 1;
    unsubscribeRef.current?.();
    const client = clientRef.current;
    clientRef.current = null;
    if (client) void disconnectConvai(client);
  }, []);

  return {
    uiState,
    knowledgeQuery: '',
    setKnowledgeQuery: () => undefined,
    messages,
    session,
    error,
    transcriptSaveMessage,
    diagnostics,
    start,
    sendText,
    interruptForExplicitUserTurn,
    stop,
    reset,
    convaiClient,
    convaiCharacterId,
    sessionMode,
    setSessionMode,
    previousSession,
    hasPreviousSession: Boolean(previousSession?.sessionId),
  };
}
