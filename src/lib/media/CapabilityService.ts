/**
 * CapabilityService — the single place browser feature-detection happens.
 *
 * No other module should probe `navigator`/`window` for capabilities; they read
 * an immutable `CapabilitySnapshot` instead. The environment is injected so the
 * whole thing is testable without a browser.
 */

export interface CapabilitySnapshot {
  readonly speech: boolean;
  readonly webAudio: boolean;
  readonly wakeLock: boolean;
  readonly vibration: boolean;
  readonly notifications: boolean;
  readonly reducedMotion: boolean;
  readonly visibility: boolean;
}

/** Raw browser handles the service inspects (all optional → all detectable). */
export interface CapabilityEnv {
  readonly speechSynthesis?: unknown;
  /** AudioContext / webkitAudioContext constructor, if present. */
  readonly audioContext?: unknown;
  /** navigator.wakeLock, if present. */
  readonly wakeLock?: unknown;
  /** navigator.vibrate, if present. */
  readonly vibrate?: unknown;
  readonly notification?: unknown;
  readonly matchMedia?: ((query: string) => { matches: boolean } | null | undefined) | undefined;
  /** True when document.visibilityState exists. */
  readonly visibilitySupported?: boolean;
}

export class CapabilityService {
  constructor(private readonly env: CapabilityEnv) {}

  detect(): CapabilitySnapshot {
    return {
      speech: this.env.speechSynthesis != null,
      webAudio: this.env.audioContext != null,
      wakeLock: this.env.wakeLock != null,
      vibration: typeof this.env.vibrate === 'function',
      notifications: this.env.notification != null,
      reducedMotion: this.probeReducedMotion(),
      visibility: this.env.visibilitySupported ?? false,
    };
  }

  private probeReducedMotion(): boolean {
    try {
      return this.env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  }
}

/** Resolve the real browser environment (guarded for SSR / Node). */
export function resolveCapabilityEnv(): CapabilityEnv {
  if (typeof window === 'undefined') return {};
  const w = window as unknown as Record<string, unknown>;
  const nav =
    typeof navigator !== 'undefined' ? (navigator as unknown as Record<string, unknown>) : undefined;
  const vibrate = nav && typeof nav.vibrate === 'function' ? (nav.vibrate as unknown) : undefined;

  return {
    speechSynthesis: typeof w.speechSynthesis !== 'undefined' ? w.speechSynthesis : undefined,
    audioContext: w.AudioContext ?? w.webkitAudioContext,
    wakeLock: nav?.wakeLock,
    vibrate,
    notification: typeof w.Notification !== 'undefined' ? w.Notification : undefined,
    matchMedia:
      typeof w.matchMedia === 'function'
        ? (q: string) => (w.matchMedia as (q: string) => { matches: boolean })(q)
        : undefined,
    visibilitySupported:
      typeof document !== 'undefined' && typeof document.visibilityState === 'string',
  };
}
