import { useEffect, useRef, useState } from 'react';
import type { UiState } from '../types/conversation';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  lang: string;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }> & { isFinal: boolean }>;
  }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface Props {
  state: UiState;
  onFinalText: (text: string) => Promise<void>;
  onSpeechStart?: () => void;
}

// Browser SpeechRecognition can mark a clause as final before the speaker has
// finished the complete thought (especially after a short pause). Keep the
// utterance open through a conservative silence window and keep listening
// across browser recognition restarts.
const DEFAULT_SILENCE_MS = 1050;
const INCOMPLETE_UTTERANCE_SILENCE_MS = 2100;
const TERMINAL_PUNCTUATION_SILENCE_MS = 450;
const RESTART_DELAY_MS = 250;

// Browser speech recognition has no reliable semantic end-of-sentence signal.
// Use lightweight linguistic cues only to choose how long to wait after the
// last result. This is deliberately domain-agnostic: it does not know any
// customer, product, or document vocabulary.
const INCOMPLETE_ENDINGS = new Set([
  'about', 'above', 'across', 'after', 'against', 'along', 'around', 'at',
  'before', 'behind', 'below', 'beside', 'between', 'beyond', 'by', 'despite',
  'during', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of',
  'on', 'onto', 'over', 'regarding', 'through', 'to', 'toward', 'under',
  'until', 'upon', 'via', 'with', 'within', 'without', 'and', 'or', 'but',
  'because', 'if', 'than', 'that', 'the', 'a', 'an', 'is', 'are', 'was', 'were',
  'can', 'could', 'would', 'should', 'do', 'does', 'did', 'how', 'what', 'why',
  'who', 'which', 'where', 'when', 'please',
]);

export function getBufferedText(finalText: string, interimText: string): string {
  return `${finalText} ${interimText}`.replace(/\s+/g, ' ').trim();
}

export function completionDelayMs(text: string): number {
  const normalized = text.trim();
  if (!normalized) return DEFAULT_SILENCE_MS;
  if (/[.!?]$/.test(normalized)) return TERMINAL_PUNCTUATION_SILENCE_MS;

  const words = normalized.split(/\s+/);
  const lastWord = words[words.length - 1]?.toLowerCase().replace(/[^a-z']+$/g, '') ?? '';
  if (INCOMPLETE_ENDINGS.has(lastWord)) return INCOMPLETE_UTTERANCE_SILENCE_MS;

  // Longer natural questions/statements need a little more settling time,
  // while short complete phrases can be processed quickly.
  return words.length >= 5 ? 1200 : DEFAULT_SILENCE_MS;
}

export function BrowserSpeechInput({ state, onFinalText, onSpeechStart }: Props) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const submittingRef = useRef(false);
  const micEnabledRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const finalizeTimerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef('');
  const listeningSessionRef = useRef(0);
  const interruptionModeRef = useRef(false);

  const [micEnabled, setMicEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const interimTranscriptRef = useRef('');
  const [error, setError] = useState<string | null>(null);

  const Constructor = typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition
    : undefined;
  const supported = Boolean(Constructor);
  const sessionActive = !['IDLE', 'COMPLETED', 'ERROR', 'STOPPING', 'SAVING_TRANSCRIPT'].includes(state);
  const canUseMic = sessionActive && supported;
  const displayedTranscript = [finalTranscriptRef.current, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  function clearTimer(ref: { current: number | null }) {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  }

  function stopRecognition(options: { clearTranscript?: boolean } = {}) {
    listeningSessionRef.current += 1;
    clearTimer(restartTimerRef);
    clearTimer(finalizeTimerRef);
    try {
      recognitionRef.current?.stop();
    } catch {
      // Browser speech recognition may already have ended.
    }
    recognitionRef.current = null;
    setListening(false);
    setInterim('');
    interimTranscriptRef.current = '';
    if (options.clearTranscript !== false) finalTranscriptRef.current = '';
  }

  async function submitBufferedText() {
    clearTimer(finalizeTimerRef);
    const text = getBufferedText(finalTranscriptRef.current, interimTranscriptRef.current);
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setInterim('');
    if (!text || submittingRef.current) return;

    interruptionModeRef.current = false;
    stopRecognition({ clearTranscript: false });
    submittingRef.current = true;
    try {
      await onFinalText(text);
    } finally {
      submittingRef.current = false;
    }
  }

  function scheduleSubmit(textOverride?: string) {
    clearTimer(finalizeTimerRef);
    const text = textOverride ?? getBufferedText(finalTranscriptRef.current, interim);
    if (!text) return;
    finalizeTimerRef.current = window.setTimeout(() => {
      void submitBufferedText();
    }, completionDelayMs(text));
  }

  function startRecognition() {
    if (!Constructor || !canUseMic || listening || recognitionRef.current || submittingRef.current) return;
    setError(null);
    // Do not clear the committed transcript here. Browser recognition can
    // restart while the actor is still finishing the same utterance. The
    // buffered text is cleared only when a turn is submitted or the mic is
    // explicitly turned off.
    setInterim('');
    interimTranscriptRef.current = '';
    clearTimer(restartTimerRef);
    clearTimer(finalizeTimerRef);

    const recognition = new Constructor();
    const recognitionSession = listeningSessionRef.current + 1;
    listeningSessionRef.current = recognitionSession;

    recognition.onspeechstart = () => {
      if (listeningSessionRef.current !== recognitionSession) return;
      // A new speech segment means the actor is still talking. Never finalize
      // a partial clause while the recognizer has detected another segment.
      clearTimer(finalizeTimerRef);
      // The actor explicitly pressed the interruption control before this
      // recognition session was created. Never interrupt merely because the
      // browser is listening in normal READY/LISTENING mode.
      if (state === 'NPC_SPEAKING' && interruptionModeRef.current) onSpeechStart?.();
    };
    recognition.onspeechend = () => {
      if (listeningSessionRef.current !== recognitionSession) return;
      const buffered = getBufferedText(finalTranscriptRef.current, interimTranscriptRef.current);
      if (buffered) scheduleSubmit(buffered);
    };
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      if (listeningSessionRef.current !== recognitionSession) return;
      setListening(false);
      recognitionRef.current = null;

      // Chrome can end recognition after a short period even when continuous
      // mode is enabled. Restart while the mic remains enabled so a partial
      // sentence can continue across recognition sessions. Final submission
      // is governed by the silence timer, not by onend.
      if (micEnabledRef.current && canUseMic && !submittingRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          if (micEnabledRef.current && canUseMic && !submittingRef.current) startRecognition();
        }, RESTART_DELAY_MS);
        const buffered = getBufferedText(finalTranscriptRef.current, interimTranscriptRef.current);
        if (buffered) scheduleSubmit(buffered);
      }
    };
    recognition.onerror = (event) => {
      if (listeningSessionRef.current !== recognitionSession) return;
      setListening(false);
      recognitionRef.current = null;
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Browser speech input error: ${event.error ?? 'unknown error'}`);
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        micEnabledRef.current = false;
        setMicEnabled(false);
        interruptionModeRef.current = false;
      }
    };
    recognition.onresult = (event) => {
      if (listeningSessionRef.current !== recognitionSession) return;

      // IMPORTANT: a final result is not necessarily the end of the human's
      // sentence. Chrome may finalize "can you tell me about" and deliver
      // "HeyGen AI" in a later result after a short pause. Any new result
      // therefore keeps the utterance open. Only sustained silence finalizes.
      clearTimer(finalizeTimerRef);

      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;

        // Prefer the recognition alternative with the highest confidence when
        // the browser provides confidence scores. This remains entirely local
        // and avoids hardcoding vocabulary for any customer/domain.
        let bestTranscript = '';
        let bestConfidence = -1;
        const alternativeCount = result.length;
        for (let alternativeIndex = 0; alternativeIndex < alternativeCount; alternativeIndex += 1) {
          const alternative = result[alternativeIndex];
          if (!alternative) continue;
          const confidence = typeof alternative.confidence === 'number'
            ? alternative.confidence
            : alternativeIndex === 0 ? 0 : -1;
          if (confidence > bestConfidence || (bestTranscript === '' && confidence === bestConfidence)) {
            bestTranscript = alternative.transcript ?? '';
            bestConfidence = confidence;
          }
        }

        if (result.isFinal) finalText += `${bestTranscript} `;
        else interimText += `${bestTranscript} `;
      }

      if (finalText.trim()) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`
          .replace(/\s+/g, ' ')
          .trim();
      }

      interimTranscriptRef.current = interimText.trim();
      setInterim(interimTranscriptRef.current);

      // Some Chromium versions do not emit a dependable speechend event.
      // Reset a result-inactivity timer so a complete utterance still gets
      // submitted, while incomplete grammatical endings receive a longer
      // window for the next recognition segment.
      const buffered = getBufferedText(finalTranscriptRef.current, interimTranscriptRef.current);
      if (buffered) scheduleSubmit(buffered);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (caught) {
      recognitionRef.current = null;
      setListening(false);
      setError(caught instanceof Error ? caught.message : 'Unable to start browser speech input.');
    }
  }

  function enableMic() {
    if (!canUseMic) return;
    micEnabledRef.current = true;
    setMicEnabled(true);
    if (state !== 'NPC_SPEAKING') startRecognition();
  }

  function disableMic() {
    micEnabledRef.current = false;
    interruptionModeRef.current = false;
    setMicEnabled(false);
    stopRecognition();
    setError(null);
  }

  function handleMicButton() {
    if (micEnabled) disableMic();
    else enableMic();
  }

  function handleVoiceAction() {
    if (state === 'NPC_SPEAKING') {
      // Barge-in is explicit: opening the interruption listener is the actor's
      // intent. This prevents Elizabeth's own voice or nearby conversation from
      // passively triggering an interruption.
      if (!micEnabled) {
        micEnabledRef.current = true;
        setMicEnabled(true);
      }
      interruptionModeRef.current = true;
      startRecognition();
      return;
    }
    if (!micEnabled) enableMic();
  }

  useEffect(() => {
    if (!sessionActive && micEnabledRef.current) disableMic();
  }, [sessionActive]);

  useEffect(() => () => {
    micEnabledRef.current = false;
    interruptionModeRef.current = false;
    clearTimer(restartTimerRef);
    clearTimer(finalizeTimerRef);
    try {
      recognitionRef.current?.abort();
    } catch {
      // Best-effort browser cleanup.
    }
    recognitionRef.current = null;
  }, []);

  // While Elizabeth is speaking, stop passive browser listening. The actor must
  // explicitly start the interruption listener, preventing speaker/room noise
  // from becoming an accidental user turn.
  useEffect(() => {
    if (state === 'NPC_SPEAKING' && listening && !interruptionModeRef.current) {
      stopRecognition({ clearTranscript: true });
    }
    if ((state === 'READY' || state === 'LISTENING') && micEnabledRef.current && !listening && !submittingRef.current && !interruptionModeRef.current) {
      const timer = window.setTimeout(() => startRecognition(), RESTART_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [state, listening]);

  return (
    <div className={`speech-input-control ${micEnabled ? 'mic-enabled' : 'mic-disabled'}`}>
      <div className="speech-control-main">
        <button
          className={`secondary-button mic-toggle ${micEnabled ? 'mic-on' : ''}`}
          type="button"
          onClick={handleMicButton}
          disabled={!canUseMic || submittingRef.current}
          title={!supported ? 'Chrome or Edge browser speech input is required.' : undefined}
          aria-pressed={micEnabled}
        >
          <span className="mic-status-icon" aria-hidden="true">{micEnabled ? '🎙' : '🔇'}</span>
          <span>{micEnabled ? 'Mic on' : 'Mic off'}</span>
        </button>
        {state === 'NPC_SPEAKING' && (
          <button
            className="secondary-button voice-action-button interrupt-button"
            type="button"
            onClick={handleVoiceAction}
            disabled={!canUseMic || submittingRef.current}
            title="Start an intentional voice interruption. Elizabeth will stop when you begin speaking."
          >
            🎙 Interrupt &amp; speak
          </button>
        )}
        <span className={`mic-live-status ${listening ? 'active' : ''}`} role="status">
          <span className="mic-live-dot" />
          {listening ? 'Listening for your voice' : micEnabled ? 'Mic ready — click to speak' : 'Microphone is off'}
        </span>
      </div>
      {!supported && <span className="speech-hint">Browser speech input is unavailable; use text input.</span>}
      {micEnabled && <span className="speech-hint">Mic stays off until you enable it. Turn it off whenever you are speaking with someone nearby.</span>}
      {displayedTranscript && <span className="speech-interim"><strong>Hearing:</strong> {displayedTranscript}</span>}
      {state === 'NPC_SPEAKING' && <span className="speech-waiting">Elizabeth is speaking. Passive listening is paused to avoid capturing Elizabeth or nearby voices. Use <strong>Interrupt &amp; speak</strong> when you intentionally want to barge in.</span>}
      {error && <span className="speech-error" role="alert">{error}</span>}
    </div>
  );
}
