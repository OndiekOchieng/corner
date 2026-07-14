/**
 * SpeechManager — wraps the existing SpeechService for the Media Runtime.
 *
 * It owns speech *lifecycle and readiness* (init, voice loading, pause/resume/
 * cancel, availability, graceful degradation) and exposes a `SpeechSink` for the
 * Coach Runtime to render into. It contains NO coaching logic — it never decides
 * what to say, only whether the browser can say it.
 */

import type { SpeechSink } from '../coaching';
import type {
  SpeechServiceStats,
  VoiceInfo,
  VoiceStatus,
  VoiceReadinessDiagnostics,
} from '@/lib/speech/SpeechService';

export type { SpeechServiceStats, VoiceInfo, VoiceStatus, VoiceReadinessDiagnostics };

/** The subset of SpeechService the manager depends on (structural — no import). */
export interface SpeechEngine {
  speak(text: string): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  clearQueue(): void;
  isSupported(): boolean;
  setEnabled(enabled: boolean): void;
  setRate(rate: number): void;
  setPitch(pitch: number): void;
  setVolume(volume: number): void;
  setVoice(voiceURI: string | null): void;
  getVoices(): readonly unknown[];
  onVoicesChanged(listener: (voices: readonly unknown[]) => void): () => void;
  /** Optional: refresh voices + clear a suspended queue from a gesture (Chrome/iOS). */
  warm?(): void;
  /** Optional: instance-local teardown that does NOT cancel the shared global engine. */
  dispose?(): void;
  /** Optional: the currently selected voice (for diagnostics). */
  getSelectedVoice?(): { name: string } | null;
  /** Optional: stable instance id + boundary counters (speech-pipeline trace). */
  readonly instanceId?: number;
  stats?(): SpeechServiceStats;
  /** Optional: voice-readiness contract (PR-020A). */
  voiceReady?(): boolean;
  voiceStatus?(): VoiceStatus;
  selectedVoiceInfo?(): VoiceInfo | null;
  availableVoiceInfos?(): VoiceInfo[];
  voiceDiagnostics?(): VoiceReadinessDiagnostics;
}

export interface SpeechSettings {
  readonly enabled: boolean;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
  readonly voiceURI: string | null;
}

let speechManagerCounter = 0;

export class SpeechManager {
  private voicesReady = false;
  private readonly unsubscribe: () => void;
  /** Stable identity for the pipeline trace (proves a single active manager). */
  readonly instanceId = ++speechManagerCounter;

  constructor(private readonly engine: SpeechEngine) {
    this.voicesReady = this.engine.getVoices().length > 0;
    this.unsubscribe = this.engine.onVoicesChanged((voices) => {
      if (voices.length > 0) this.voicesReady = true;
    });
  }

  isAvailable(): boolean {
    return this.engine.isSupported();
  }

  isVoicesReady(): boolean {
    return this.voicesReady;
  }

  /** Number of loaded voices (0 until the browser populates them — async on Chrome). */
  voiceCount(): number {
    return this.engine.getVoices().length;
  }

  /** The selected voice name, or null for the browser default (diagnostics). */
  selectedVoice(): string | null {
    return this.engine.getSelectedVoice?.()?.name ?? null;
  }

  /** Warm speech from a user gesture (voice load + unstick). */
  warm(): void {
    this.engine.warm?.();
    if (this.engine.getVoices().length > 0) this.voicesReady = true;
  }

  /** The underlying SpeechService id + boundary counters (pipeline trace). */
  serviceId(): number | null {
    return this.engine.instanceId ?? null;
  }
  serviceStats(): SpeechServiceStats | null {
    return this.engine.stats?.() ?? null;
  }

  // --- Voice readiness (PR-020A) — browser-free, forwarded to the engine ------

  /** True when the intro no longer needs to wait for the selected voice. */
  voiceReady(): boolean {
    return this.engine.voiceReady?.() ?? true; // engines without the contract are always "ready"
  }
  voiceStatus(): VoiceStatus {
    return this.engine.voiceStatus?.() ?? (this.isAvailable() ? 'ready-default' : 'unsupported');
  }
  /** The effective session voice as a browser-free DTO (null = browser default). */
  selectedVoiceInfo(): VoiceInfo | null {
    return this.engine.selectedVoiceInfo?.() ?? null;
  }
  availableVoices(): readonly VoiceInfo[] {
    return this.engine.availableVoiceInfos?.() ?? [];
  }
  voiceDiagnostics(): VoiceReadinessDiagnostics {
    return (
      this.engine.voiceDiagnostics?.() ?? {
        ready: this.voiceReady(),
        status: this.voiceStatus(),
        selectedVoice: this.selectedVoice(),
        resolutionMs: null,
        fallbackUsed: false,
        source: this.isAvailable() ? 'default' : 'unsupported',
      }
    );
  }

  /** The render port handed to the Coach Runtime. Degrades to no-ops safely. */
  sink(): SpeechSink {
    return {
      speak: (text: string) => this.engine.speak(text),
      pause: () => this.engine.pause(),
      resume: () => this.engine.resume(),
      cancel: () => this.engine.cancel(),
      clearPending: () => this.engine.clearQueue(),
    };
  }

  configure(settings: SpeechSettings): void {
    this.engine.setEnabled(settings.enabled);
    this.engine.setRate(settings.rate);
    this.engine.setPitch(settings.pitch);
    this.engine.setVolume(settings.volume);
    this.engine.setVoice(settings.voiceURI);
  }

  pause(): void {
    this.engine.pause();
  }
  resume(): void {
    this.engine.resume();
  }
  cancel(): void {
    this.engine.cancel();
  }

  dispose(): void {
    this.unsubscribe();
    // Prefer instance-local teardown so disposing one instance never cancels the
    // shared global speechSynthesis (which would abort another instance's
    // utterance — the StrictMode build→dispose→build silence). Fall back to
    // cancel() only for engines that predate dispose() (e.g. test fakes).
    if (this.engine.dispose) this.engine.dispose();
    else this.engine.cancel();
  }
}
