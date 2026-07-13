/**
 * SpeechService
 * -------------------------------------------------------------------------
 * The ONLY module in the application that is allowed to touch the browser
 * Speech Synthesis API (`window.speechSynthesis` / `SpeechSynthesisUtterance`).
 *
 * It exposes a small, deterministic, framework-free API:
 *   speak / pause / resume / cancel / clearQueue
 *   setVoice / setRate / setPitch / setVolume / setEnabled
 *   isSpeaking / isSupported / getVoices / onVoicesChanged
 *
 * Guarantees:
 *   - Utterances never overlap. Only one utterance is handed to the browser at
 *     a time; the next one starts on the previous one's `end`/`error` event.
 *   - Speech never interrupts itself unless `cancel()` is called explicitly.
 *   - Everything is injectable (synth + utterance factory) so it can be unit
 *     tested without a real browser or real voices.
 *
 * UI components MUST NOT import this directly — they talk to the CoachEngine
 * (via the `useSpeechCoach` hook). This module is the bottom of the stack:
 *   WorkoutEngine -> CoachEngine -> SpeechService -> Browser Speech API
 */

/** Minimal shape of `window.speechSynthesis` that this service depends on. */
export interface SpeechSynthesisLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  getVoices(): SpeechSynthesisVoice[];
  speaking: boolean;
  paused: boolean;
  onvoiceschanged: ((this: unknown, ev: Event) => unknown) | null;
}

/** Minimal shape of a `SpeechSynthesisUtterance`. */
export interface UtteranceLike {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
}

export interface SpeechServiceConfig {
  /** Injected synthesis engine. Defaults to `window.speechSynthesis`. */
  synth?: SpeechSynthesisLike | null;
  /** Injected utterance factory. Defaults to `new SpeechSynthesisUtterance()`. */
  createUtterance?: (text: string) => UtteranceLike;
  enabled?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
}

type VoicesListener = (voices: SpeechSynthesisVoice[]) => void;

/**
 * Development-only boundary trace. Call sites gate on an INLINE
 * `process.env.NODE_ENV` check so the compiler folds it to dead code and strips
 * both the call and its string arguments from production (an intermediate const
 * is not reliably folded).
 */
function trace(...args: unknown[]): void {
  console.log('[SpeechService]', ...args);
}

let instanceCounter = 0;

/** A snapshot of the speech boundary — proves whether speak() reaches the browser. */
export interface SpeechServiceStats {
  readonly instanceId: number;
  readonly speakCalls: number;
  readonly synthSpeakCalls: number;
  readonly started: number;
  readonly ended: number;
  readonly errors: number;
  readonly queueLength: number;
  readonly currentText: string | null;
  readonly selectedVoice: string | null;
  readonly speaking: boolean;
  readonly paused: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function resolveDefaultSynth(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined') return null;
  return (window.speechSynthesis as unknown as SpeechSynthesisLike) ?? null;
}

function resolveDefaultUtteranceFactory():
  | ((text: string) => UtteranceLike)
  | null {
  if (typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    return null;
  }
  return (text: string) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike;
}

export class SpeechService {
  private readonly synth: SpeechSynthesisLike | null;
  private readonly createUtterance: ((text: string) => UtteranceLike) | null;

  private enabled: boolean;
  private rate: number;
  private pitch: number;
  private volume: number;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private pendingVoiceURI: string | null = null;

  private queue: UtteranceLike[] = [];
  private current: UtteranceLike | null = null;
  private speaking = false;
  private paused = false;

  private voices: SpeechSynthesisVoice[] = [];
  private voicesListeners = new Set<VoicesListener>();

  /** Stable identity + boundary counters for the speech-pipeline trace (PR-014). */
  readonly instanceId = ++instanceCounter;
  private speakCalls = 0;
  private synthSpeakCalls = 0;
  private startedCount = 0;
  private endedCount = 0;
  private errorCount = 0;

  constructor(config: SpeechServiceConfig = {}) {
    this.synth = config.synth !== undefined ? config.synth : resolveDefaultSynth();
    this.createUtterance =
      config.createUtterance ?? resolveDefaultUtteranceFactory();

    this.enabled = config.enabled ?? true;
    this.rate = clamp(config.rate ?? 1, 0.1, 10);
    this.pitch = clamp(config.pitch ?? 1, 0, 2);
    this.volume = clamp(config.volume ?? 1, 0, 1);

    if (this.synth) {
      this.loadVoices();
      // Voices load asynchronously in most browsers.
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  // ---------------------------------------------------------------------------
  // Support / capability
  // ---------------------------------------------------------------------------

  /** True when a usable synthesis engine and utterance factory are available. */
  isSupported(): boolean {
    return this.synth !== null && this.createUtterance !== null;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Number of queued (not-yet-started) utterances. */
  get pendingCount(): number {
    return this.queue.length;
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }

  setRate(rate: number): void {
    this.rate = clamp(rate, 0.1, 10);
  }

  setPitch(pitch: number): void {
    this.pitch = clamp(pitch, 0, 2);
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
  }

  /**
   * Select a voice by its `voiceURI`. If voices have not loaded yet the choice
   * is remembered and applied once `onvoiceschanged` fires. Pass `null` to fall
   * back to the browser default voice.
   */
  setVoice(voiceURI: string | null): void {
    this.pendingVoiceURI = voiceURI;
    if (!voiceURI) {
      this.selectedVoice = null;
      return;
    }
    const match = this.voices.find((v) => v.voiceURI === voiceURI);
    if (match) this.selectedVoice = match;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  /** Subscribe to voice-list changes. Returns an unsubscribe function. */
  onVoicesChanged(listener: VoicesListener): () => void {
    this.voicesListeners.add(listener);
    return () => this.voicesListeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  /**
   * Enqueue a phrase to be spoken. Enqueued phrases play strictly in order and
   * never overlap. No-op when speech is unsupported, disabled, or empty.
   */
  speak(text: string): void {
    this.speakCalls += 1;
    if (!this.isSupported() || !this.enabled) {
      process.env.NODE_ENV === 'development' && trace(`#${this.instanceId} speak() DROPPED (supported=${this.isSupported()} enabled=${this.enabled})`, text);
      return;
    }
    const trimmed = text?.trim();
    if (!trimmed) return;

    process.env.NODE_ENV === 'development' && trace(`#${this.instanceId} speak() queued:`, trimmed);
    const utterance = this.buildUtterance(trimmed);
    this.queue.push(utterance);
    this.pump();
  }

  /** Pause the current utterance and hold the queue. */
  pause(): void {
    if (!this.synth) return;
    this.paused = true;
    this.synth.pause();
  }

  /** Resume a paused utterance and continue draining the queue. */
  resume(): void {
    if (!this.synth) return;
    this.paused = false;
    this.synth.resume();
    this.pump();
  }

  /**
   * Stop everything: cancel the current utterance and drop the queue. This is
   * the EXPLICIT stop (barge-in, quit, disable) and DOES cancel the shared
   * global `speechSynthesis` — that is the intended effect for a real cancel.
   * Teardown must NOT use this; teardown calls `dispose()` (below).
   */
  cancel(): void {
    this.queue = [];
    this.current = null;
    this.speaking = false;
    this.paused = false;
    this.synth?.cancel();
  }

  /**
   * Instance-local teardown. Unlike `cancel()`, this NEVER calls the shared
   * global `speechSynthesis.cancel()`. `window.speechSynthesis` is a single
   * global shared by every SpeechService instance, so cancelling it while
   * disposing one instance would abort an utterance owned by another — which is
   * exactly what happened under React StrictMode's build→dispose→build cycle
   * (the disposed instance cancelled its own first utterance before `onstart`,
   * producing `error="canceled"` and silence). Disposal only neutralises THIS
   * instance: it detaches the in-flight utterance's callbacks (so a dead
   * instance never mutates state) and drops its own queue/listeners. Anything
   * already handed to the browser is left to finish under the browser's
   * ownership.
   */
  dispose(): void {
    if (this.current) {
      this.current.onstart = null;
      this.current.onend = null;
      this.current.onerror = null;
    }
    this.queue = [];
    this.current = null;
    this.speaking = false;
    this.paused = false;
    this.voicesListeners.clear();
    // Intentionally NO this.synth.cancel() — see the doc comment above.
  }

  /** Drop pending utterances but let the currently-speaking one finish. */
  clearQueue(): void {
    this.queue = [];
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private buildUtterance(text: string): UtteranceLike {
    // `createUtterance` is guaranteed non-null here via isSupported() gate.
    const utterance = this.createUtterance!(text);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    return utterance;
  }

  /** Start the next utterance if idle and not paused. */
  private pump(): void {
    if (!this.synth) return;
    if (this.paused || this.speaking) return;

    const next = this.queue.shift();
    if (!next) return;

    this.current = next;
    this.speaking = true;

    // Instrument the browser boundary — this is where "speak() called but nothing
    // heard" is proven: synth.speak fires but onstart never does.
    next.onstart = () => {
      this.startedCount += 1;
      process.env.NODE_ENV === 'development' && trace(`#${this.instanceId} utterance ONSTART:`, next.text);
    };
    next.onend = () => {
      this.endedCount += 1;
      process.env.NODE_ENV === 'development' && trace(`#${this.instanceId} utterance ONEND:`, next.text);
      this.handleUtteranceDone();
    };
    next.onerror = (event?: unknown) => {
      this.errorCount += 1;
      // Log the raw browser error payload (dev only).
      process.env.NODE_ENV === 'development' && trace(`#${this.instanceId} utterance ONERROR:`, next.text, event);
      this.handleUtteranceDone();
    };

    this.synthSpeakCalls += 1;
    process.env.NODE_ENV === 'development' && trace(`#${this.instanceId} synth.speak():`, next.text, `(voice=${this.selectedVoice?.name ?? 'default'})`);
    this.synth.speak(next);
    // Only nudge when the browser genuinely suspended the queue (Chrome's "stuck
    // paused" bug). Unconditionally resuming a fresh utterance can interfere on
    // some engines, so gate it on the actual paused state.
    if (this.synth.paused) this.synth.resume();
  }

  /**
   * Warm speech up from a user gesture: refresh the (async-loading) voice list —
   * Chrome returns none until this runs — and clear any suspended state. Called
   * by the Media Runtime on unlock(). Safe no-op where unsupported.
   */
  warm(): void {
    if (!this.synth) return;
    this.loadVoices();
    this.synth.resume();
  }

  /** Boundary counters for the speech-pipeline trace (dev diagnostics). */
  stats(): SpeechServiceStats {
    return {
      instanceId: this.instanceId,
      speakCalls: this.speakCalls,
      synthSpeakCalls: this.synthSpeakCalls,
      started: this.startedCount,
      ended: this.endedCount,
      errors: this.errorCount,
      queueLength: this.queue.length,
      currentText: this.current?.text ?? null,
      selectedVoice: this.selectedVoice?.name ?? null,
      speaking: this.speaking,
      paused: this.paused,
    };
  }

  private handleUtteranceDone(): void {
    this.speaking = false;
    this.current = null;
    this.pump();
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices() ?? [];
    // Resolve a deferred voice selection now that voices are available.
    if (this.pendingVoiceURI && !this.selectedVoice) {
      this.setVoice(this.pendingVoiceURI);
    }
    this.voicesListeners.forEach((listener) => listener(this.voices));
  }
}
