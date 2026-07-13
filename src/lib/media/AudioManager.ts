/**
 * AudioManager — owns the browser AudioContext. Nothing else may touch it.
 *
 * Handles autoplay policy: the context is created lazily and only starts making
 * sound after `unlock()` runs inside a trusted user gesture. Everything is
 * injectable (the context factory) so it runs headless in tests.
 */

export interface OscillatorLike {
  frequency: { value: number };
  type: string;
  connect(node: unknown): void;
  start(when: number): void;
  stop(when: number): void;
}

export interface GainNodeLike {
  gain: {
    setValueAtTime(value: number, when: number): void;
    exponentialRampToValueAtTime(value: number, when: number): void;
  };
  connect(node: unknown): void;
}

export interface AudioContextLike {
  state: 'suspended' | 'running' | 'closed';
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainNodeLike;
}

export type AudioContextFactory = () => AudioContextLike;
export type BellKind = 'round-start' | 'rest-start' | 'finish' | 'warning';

export interface AudioManagerOptions {
  /** Factory for the AudioContext. `null` ⇒ Web Audio unsupported (all no-ops). */
  readonly createContext?: AudioContextFactory | null;
  readonly onResume?: () => void;
  readonly onAutoplayFailure?: () => void;
}

interface Tone {
  readonly freq: number;
  readonly offsetSec: number;
  readonly durSec: number;
  readonly volume: number;
}

const BELLS: Record<BellKind, readonly Tone[]> = {
  'round-start': [
    { freq: 850, offsetSec: 0, durSec: 0.2, volume: 0.4 },
    { freq: 850, offsetSec: 0.25, durSec: 0.2, volume: 0.4 },
  ],
  'rest-start': [{ freq: 600, offsetSec: 0, durSec: 0.4, volume: 0.3 }],
  finish: [
    { freq: 600, offsetSec: 0, durSec: 0.2, volume: 0.4 },
    { freq: 700, offsetSec: 0.25, durSec: 0.2, volume: 0.4 },
    { freq: 800, offsetSec: 0.5, durSec: 0.3, volume: 0.4 },
  ],
  warning: [{ freq: 1000, offsetSec: 0, durSec: 0.15, volume: 0.3 }],
};

export class AudioManager {
  private readonly factory: AudioContextFactory | null;
  private readonly onResume?: () => void;
  private readonly onAutoplayFailure?: () => void;
  private ctx: AudioContextLike | null = null;
  private unlocked = false;

  constructor(options: AudioManagerOptions = {}) {
    this.factory = options.createContext ?? null;
    this.onResume = options.onResume;
    this.onAutoplayFailure = options.onAutoplayFailure;
  }

  isSupported(): boolean {
    return this.factory != null;
  }

  isUnlocked(): boolean {
    return this.unlocked && this.ctx?.state === 'running';
  }

  state(): AudioContextLike['state'] | 'none' {
    return this.ctx?.state ?? 'none';
  }

  /** Create the context if needed. Returns null when Web Audio is unsupported. */
  private ensure(): AudioContextLike | null {
    if (!this.factory) return null;
    if (!this.ctx) {
      try {
        this.ctx = this.factory();
      } catch {
        this.onAutoplayFailure?.();
        return null;
      }
    }
    return this.ctx;
  }

  /** Unlock from a trusted user gesture: create + resume the context. */
  async unlock(): Promise<boolean> {
    const ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.onResume?.();
      } catch {
        this.onAutoplayFailure?.();
        this.unlocked = false;
        return false;
      }
    }
    this.unlocked = ctx.state === 'running';
    return this.unlocked;
  }

  /** Resume after a visibility change / interruption (no gesture required if already unlocked once). */
  async resume(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'suspended') return;
    try {
      await ctx.resume();
      this.onResume?.();
      // `await` mutates state; re-read through a cast so TS doesn't keep the
      // pre-await narrowing to 'suspended'.
      this.unlocked = (ctx.state as string) === 'running';
    } catch {
      this.onAutoplayFailure?.();
    }
  }

  async suspend(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    try {
      await ctx.suspend();
    } catch {
      /* best-effort */
    }
  }

  /** Play a single tone. Silently no-ops if audio is not running. */
  play(freq: number, durSec: number, volume: number): void {
    this.emit([{ freq, offsetSec: 0, durSec, volume }]);
  }

  /** Play a transition bell. Silently no-ops if audio is not running. */
  playBell(kind: BellKind): void {
    this.emit(BELLS[kind]);
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.unlocked = false;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }

  private emit(tones: readonly Tone[]): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return; // locked/suspended ⇒ no sound
    for (const tone of tones) {
      try {
        this.emitTone(ctx, tone);
      } catch {
        /* one bad tone must not break the workout */
      }
    }
  }

  private emitTone(ctx: AudioContextLike, tone: Tone): void {
    const start = ctx.currentTime + tone.offsetSec;
    const end = start + tone.durSec;
    const osc = ctx.createOscillator();
    osc.frequency.value = tone.freq;
    osc.type = 'sine';
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(tone.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(end);
  }
}
