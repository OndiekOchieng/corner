/**
 * MediaRuntime — owns the browser media lifecycle for a workout.
 *
 *   Coach Runtime → Media Runtime → { Speech API, Web Audio, Wake Lock, Visibility }
 *
 * It coordinates the four managers so the athlete reliably hears the coach and
 * bells, keeps the screen awake, and survives interruptions — without any part of
 * the app touching a browser media API directly. It owns media, NOT coaching:
 * it never decides what to say, only whether/how the browser can play it.
 *
 * Every browser dependency is injected (with real-browser resolvers as defaults),
 * so the whole runtime is exercised headlessly in tests.
 */

import type { WorkoutEvent } from '../engine';
import type { SpeechSink } from '../coaching';
import { SpeechService } from '@/lib/speech/SpeechService';
import { CapabilityService, resolveCapabilityEnv, type CapabilityEnv, type CapabilitySnapshot } from './CapabilityService';
import { AudioManager, type AudioContextFactory, type AudioContextLike, type BellKind } from './AudioManager';
import {
  SpeechManager,
  type SpeechEngine,
  type SpeechSettings,
  type SpeechServiceStats,
  type VoiceInfo,
  type VoiceStatus,
  type VoiceReadinessDiagnostics,
} from './SpeechManager';
import { WakeLockManager, type WakeLockApiLike } from './WakeLockManager';
import { MediaDiagnostics, type MediaDiagnosticsSnapshot } from './MediaDiagnostics';

/** Speech-pipeline trace: instance identity + browser-boundary counters. */
export interface SpeechTraceSnapshot {
  readonly speechManagerId: number;
  readonly speechServiceId: number | null;
  readonly service: SpeechServiceStats | null;
}

/** Minimal visibility source (own, so Media doesn't depend on the Host layer). */
export interface VisibilityLike {
  current(): 'visible' | 'hidden';
  subscribe(handlers: { onVisible: () => void; onHidden: () => void }): () => void;
}

/** Minimal gesture target for one-shot audio unlock. */
export interface GestureTargetLike {
  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface MediaRuntimeDeps {
  readonly capabilityEnv?: CapabilityEnv;
  /** `null` ⇒ no Web Audio. `undefined` ⇒ resolve the real one. */
  readonly audioContextFactory?: AudioContextFactory | null;
  readonly speechEngine?: SpeechEngine;
  readonly wakeLockApi?: WakeLockApiLike | null;
  readonly visibility?: VisibilityLike | null;
  readonly gestureTarget?: GestureTargetLike | null;
}

const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

export class MediaRuntime {
  private readonly caps: CapabilitySnapshot;
  private readonly audio: AudioManager;
  private readonly speech: SpeechManager;
  private readonly wakeLock: WakeLockManager;
  private readonly diag: MediaDiagnostics;
  private readonly visibility: VisibilityLike | null;
  private readonly gestureTarget: GestureTargetLike | null;

  private bellsEnabled = true;
  private unsubVisibility: (() => void) | null = null;
  private gestureCleanup: (() => void) | null = null;
  private disposed = false;
  /** Serialises begin/end so a release can never outrun its acquire. */
  private lifecycleChain: Promise<void> = Promise.resolve();

  constructor(deps: MediaRuntimeDeps = {}) {
    this.caps = new CapabilityService(deps.capabilityEnv ?? resolveCapabilityEnv()).detect();

    const audioFactory =
      deps.audioContextFactory !== undefined ? deps.audioContextFactory : resolveAudioContextFactory();
    const speechEngine = deps.speechEngine ?? resolveSpeechEngine();
    const wakeLockApi = deps.wakeLockApi !== undefined ? deps.wakeLockApi : resolveWakeLockApi();
    this.visibility = deps.visibility !== undefined ? deps.visibility : resolveVisibility();
    this.gestureTarget = deps.gestureTarget !== undefined ? deps.gestureTarget : resolveGestureTarget();

    this.speech = new SpeechManager(speechEngine);

    this.diag = new MediaDiagnostics({
      capabilities: this.caps,
      audioSupported: audioFactory != null,
      speechAvailable: this.speech.isAvailable(),
      wakeLockStatus: wakeLockApi ? 'released' : 'unsupported',
      visibility: this.visibility?.current() ?? 'unknown',
    });

    this.audio = new AudioManager({
      createContext: audioFactory,
      onResume: () => this.diag.recordResume(),
      onAutoplayFailure: () => this.diag.recordAutoplayFailure(),
    });

    this.wakeLock = new WakeLockManager({
      api: wakeLockApi,
      onStatusChange: (status) => this.diag.setWakeLockStatus(status),
    });

    this.unsubVisibility =
      this.visibility?.subscribe({
        onVisible: () => this.handleVisible(),
        onHidden: () => this.handleHidden(),
      }) ?? null;
  }

  // --- Capabilities & ports --------------------------------------------------

  capabilities(): CapabilitySnapshot {
    return this.caps;
  }

  /** The render port for the Coach Runtime (speech, degrading gracefully). */
  speechSink(): SpeechSink {
    return this.speech.sink();
  }

  configureSpeech(settings: SpeechSettings): void {
    this.speech.configure(settings);
    this.diag.setSpeechAvailable(this.speech.isAvailable());
    this.diag.setVoicesReady(this.speech.isVoicesReady());
  }

  setBellsEnabled(enabled: boolean): void {
    this.bellsEnabled = enabled;
    this.diag.setBellsEnabled(enabled);
  }

  // --- Gesture unlock (autoplay) ---------------------------------------------

  /** Call from a trusted user gesture. Unlocks audio + warms speech for the session. */
  async unlock(): Promise<boolean> {
    // Warm speech first (voice load + unstick) while we still hold the gesture.
    this.speech.warm();
    const ok = await this.audio.unlock();
    this.diag.setAudioUnlocked(this.audio.isUnlocked());
    return ok;
  }

  /** Arm a one-shot listener so the next interaction unlocks audio if it's still locked. */
  private armGestureUnlock(): void {
    if (!this.gestureTarget || this.audio.isUnlocked() || this.gestureCleanup) return;
    const handler = () => {
      this.gestureCleanup?.();
      void this.unlock();
    };
    const target = this.gestureTarget;
    for (const type of GESTURE_EVENTS) target.addEventListener(type, handler, { once: true });
    this.gestureCleanup = () => {
      for (const type of GESTURE_EVENTS) target.removeEventListener(type, handler);
      this.gestureCleanup = null;
    };
  }

  // --- Workout lifecycle -----------------------------------------------------

  /** The workout is starting: bring audio up, hold the screen awake. */
  begin(): Promise<void> {
    return this.enqueueLifecycle(() => this.doBegin());
  }

  /** The workout ended (finished or cancelled): release the screen. */
  end(reason = 'workout-end'): Promise<void> {
    return this.enqueueLifecycle(() => this.doEnd(reason));
  }

  private enqueueLifecycle(op: () => Promise<void>): Promise<void> {
    const next = this.lifecycleChain.then(op, op);
    this.lifecycleChain = next.catch(() => {});
    return next;
  }

  private async doBegin(): Promise<void> {
    // Keep the screen awake FIRST, independent of audio (PR-025). Audio unlock's
    // ctx.resume() can stay PENDING on iOS without a gesture; awaiting it before the
    // wake lock would block acquisition entirely and let the screen sleep even where
    // the Wake Lock API is supported. The lock is its own concern — take it up front.
    await this.wakeLock.acquire('workout-start');
    // unlock() ensures the context exists, then resumes it (autoplay-aware).
    const unlocked = await this.audio.unlock();
    this.diag.setAudioUnlocked(this.audio.isUnlocked());
    if (!unlocked) this.armGestureUnlock();
  }

  private async doEnd(reason: string): Promise<void> {
    await this.wakeLock.release(reason);
  }

  /** Event-driven lifecycle + bells. Called by the MediaRuntimePlugin. */
  onEvent(event: WorkoutEvent): void {
    switch (event.type) {
      case 'WORKOUT_STARTED':
        void this.begin();
        break;
      case 'ROUND_STARTED':
        this.bell('round-start');
        break;
      case 'REST_STARTED':
        this.bell('rest-start');
        break;
      case 'WORKOUT_COMPLETED':
        this.bell('finish');
        void this.end('workout-completed');
        break;
      case 'WORKOUT_CANCELLED':
        void this.end('workout-cancelled');
        break;
      default:
        break;
    }
  }

  private bell(kind: BellKind): void {
    if (this.bellsEnabled) this.audio.playBell(kind);
  }

  // --- Continuity: visibility ------------------------------------------------

  private handleVisible(): void {
    this.diag.setVisibility('visible');
    void this.audio.resume().then(() => this.diag.setAudioUnlocked(this.audio.isUnlocked()));
    void this.wakeLock.reacquireIfWanted('visibility-return');
  }

  private handleHidden(): void {
    this.diag.setVisibility('hidden');
    // Do NOT suspend audio or pause speech — the workout keeps running; the
    // browser will throttle/keep audio as its policy dictates.
  }

  // --- Diagnostics & teardown ------------------------------------------------

  diagnostics(): MediaDiagnosticsSnapshot {
    // Refresh the live values on read (they change as voices load / audio unlocks).
    this.diag.setAudioState(this.audio.state());
    this.diag.setVoiceCount(this.speech.voiceCount());
    this.diag.setSelectedVoice(this.speech.selectedVoice());
    this.diag.setVoicesReady(this.speech.isVoicesReady());
    this.diag.setSpeechAvailable(this.speech.isAvailable());
    this.diag.setWakeLock(this.wakeLock.stats());
    const vr = this.speech.voiceDiagnostics();
    this.diag.setVoiceReadiness({
      ready: vr.ready,
      resolutionMs: vr.resolutionMs,
      fallbackUsed: vr.fallbackUsed,
      source: vr.source,
    });
    return this.diag.snapshot();
  }

  // --- Voice readiness (PR-020A) — browser-free contract for the workout ------

  /** True when the intro no longer needs to wait for the selected voice. */
  voiceReady(): boolean {
    return this.speech.voiceReady();
  }
  voiceStatus(): VoiceStatus {
    return this.speech.voiceStatus();
  }
  /** The effective session voice as a browser-free DTO (null = browser default). */
  selectedVoice(): VoiceInfo | null {
    return this.speech.selectedVoiceInfo();
  }
  availableVoices(): readonly VoiceInfo[] {
    return this.speech.availableVoices();
  }
  voiceReadiness(): VoiceReadinessDiagnostics {
    return this.speech.voiceDiagnostics();
  }

  /** Speech-pipeline trace: instance identity + browser-boundary counters (dev). */
  speechTrace(): SpeechTraceSnapshot {
    return {
      speechManagerId: this.speech.instanceId,
      speechServiceId: this.speech.serviceId(),
      service: this.speech.serviceStats(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubVisibility?.();
    this.gestureCleanup?.();
    void this.wakeLock.release('dispose');
    this.speech.dispose();
    this.audio.dispose();
  }
}

// --- Real-browser resolvers (guarded for SSR / Node) -------------------------

function resolveAudioContextFactory(): AudioContextFactory | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.AudioContext ?? w.webkitAudioContext) as (new () => AudioContextLike) | undefined;
  if (!Ctor) return null;
  return () => new Ctor();
}

function resolveSpeechEngine(): SpeechEngine {
  // The framework-free SpeechService is the ONLY Speech API owner. Its
  // constructor is SSR-safe (no synth ⇒ isSupported() === false).
  return new SpeechService() as unknown as SpeechEngine;
}

function resolveWakeLockApi(): WakeLockApiLike | null {
  if (typeof navigator === 'undefined') return null;
  const wl = (navigator as unknown as { wakeLock?: WakeLockApiLike }).wakeLock;
  if (!wl || typeof wl.request !== 'function') return null;
  return { request: (type) => wl.request(type) };
}

function resolveVisibility(): VisibilityLike | null {
  if (typeof document === 'undefined') return null;
  return {
    current: () => (document.visibilityState === 'hidden' ? 'hidden' : 'visible'),
    subscribe: ({ onVisible, onHidden }) => {
      const handler = () => (document.visibilityState === 'hidden' ? onHidden() : onVisible());
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
  };
}

function resolveGestureTarget(): GestureTargetLike | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as GestureTargetLike;
}
