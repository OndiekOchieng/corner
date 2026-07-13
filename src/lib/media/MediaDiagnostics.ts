/**
 * MediaDiagnostics — observability for the browser media layer.
 *
 * Tracks unlock state, speech/voice availability, wake-lock status, the
 * capability snapshot, resume/autoplay-failure counts, visibility, and a coarse
 * browser-compatibility grade. Exposes immutable snapshots only; recording never
 * affects behaviour.
 */

import type { CapabilitySnapshot } from './CapabilityService';
import type { WakeLockStatus } from './WakeLockManager';

export type VisibilityState = 'visible' | 'hidden' | 'unknown';
export type BrowserCompatibility = 'full' | 'partial' | 'minimal';

export interface MediaDiagnosticsSnapshot {
  readonly audioSupported: boolean;
  readonly audioUnlocked: boolean;
  readonly speechAvailable: boolean;
  readonly voicesReady: boolean;
  readonly wakeLockStatus: WakeLockStatus;
  readonly capabilities: CapabilitySnapshot;
  readonly resumeCount: number;
  readonly autoplayFailures: number;
  readonly visibility: VisibilityState;
  readonly bellsEnabled: boolean;
  readonly browserCompatibility: BrowserCompatibility;
  /** Live: the AudioContext state ('none' | 'suspended' | 'running' | 'closed'). */
  readonly audioState: string;
  /** Live: number of loaded speech voices (0 until the browser populates them). */
  readonly voiceCount: number;
  /** Live: selected voice name, or null for the browser default. */
  readonly selectedVoice: string | null;
}

export interface MediaDiagnosticsInit {
  readonly capabilities: CapabilitySnapshot;
  readonly audioSupported: boolean;
  readonly speechAvailable: boolean;
  readonly wakeLockStatus: WakeLockStatus;
  readonly visibility: VisibilityState;
}

export class MediaDiagnostics {
  private readonly capabilities: CapabilitySnapshot;
  private readonly audioSupported: boolean;
  private audioUnlocked = false;
  private speechAvailable: boolean;
  private voicesReady = false;
  private wakeLockStatus: WakeLockStatus;
  private resumeCount = 0;
  private autoplayFailures = 0;
  private visibility: VisibilityState;
  private bellsEnabled = true;
  private audioState = 'none';
  private voiceCount = 0;
  private selectedVoice: string | null = null;

  constructor(init: MediaDiagnosticsInit) {
    this.capabilities = init.capabilities;
    this.audioSupported = init.audioSupported;
    this.speechAvailable = init.speechAvailable;
    this.wakeLockStatus = init.wakeLockStatus;
    this.visibility = init.visibility;
  }

  recordResume(): void {
    this.resumeCount += 1;
  }
  recordAutoplayFailure(): void {
    this.autoplayFailures += 1;
  }
  setAudioUnlocked(v: boolean): void {
    this.audioUnlocked = v;
  }
  setSpeechAvailable(v: boolean): void {
    this.speechAvailable = v;
  }
  setVoicesReady(v: boolean): void {
    this.voicesReady = v;
  }
  setWakeLockStatus(s: WakeLockStatus): void {
    this.wakeLockStatus = s;
  }
  setVisibility(v: VisibilityState): void {
    this.visibility = v;
  }
  setBellsEnabled(v: boolean): void {
    this.bellsEnabled = v;
  }
  setAudioState(v: string): void {
    this.audioState = v;
  }
  setVoiceCount(v: number): void {
    this.voiceCount = v;
  }
  setSelectedVoice(v: string | null): void {
    this.selectedVoice = v;
  }

  snapshot(): MediaDiagnosticsSnapshot {
    return {
      audioSupported: this.audioSupported,
      audioUnlocked: this.audioUnlocked,
      speechAvailable: this.speechAvailable,
      voicesReady: this.voicesReady,
      wakeLockStatus: this.wakeLockStatus,
      capabilities: this.capabilities,
      resumeCount: this.resumeCount,
      autoplayFailures: this.autoplayFailures,
      visibility: this.visibility,
      bellsEnabled: this.bellsEnabled,
      browserCompatibility: this.grade(),
      audioState: this.audioState,
      voiceCount: this.voiceCount,
      selectedVoice: this.selectedVoice,
    };
  }

  private grade(): BrowserCompatibility {
    const { speech, webAudio, wakeLock } = this.capabilities;
    if (speech && webAudio && wakeLock) return 'full';
    if (speech || webAudio) return 'partial';
    return 'minimal';
  }
}
