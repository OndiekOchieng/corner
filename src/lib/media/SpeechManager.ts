/**
 * SpeechManager — wraps the existing SpeechService for the Media Runtime.
 *
 * It owns speech *lifecycle and readiness* (init, voice loading, pause/resume/
 * cancel, availability, graceful degradation) and exposes a `SpeechSink` for the
 * Coach Runtime to render into. It contains NO coaching logic — it never decides
 * what to say, only whether the browser can say it.
 */

import type { SpeechSink } from '../coaching';

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
}

export interface SpeechSettings {
  readonly enabled: boolean;
  readonly rate: number;
  readonly pitch: number;
  readonly volume: number;
  readonly voiceURI: string | null;
}

export class SpeechManager {
  private voicesReady = false;
  private readonly unsubscribe: () => void;

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
    this.engine.cancel();
  }
}
