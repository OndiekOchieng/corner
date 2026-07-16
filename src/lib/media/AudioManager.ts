/**
 * AudioManager — owns the browser AudioContext. Nothing else may touch it.
 *
 * Handles autoplay policy: the context is created lazily and only starts making
 * sound after `unlock()` runs inside a trusted user gesture. Everything is
 * injectable (the context factory) so it runs headless in tests.
 */

export interface AudioBufferLike {
  readonly duration: number;
}

export interface AudioBufferSourceLike {
  buffer: AudioBufferLike | null;
  connect(node: unknown): void;
  start(when?: number): void;
}

export interface AudioContextLike {
  state: 'suspended' | 'running' | 'closed';
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioBufferSourceLike;
}

/** Loads the raw bell asset. Injected so the manager runs headless in tests. */
export type BellAssetLoader = (url: string) => Promise<ArrayBuffer>;

export type AudioContextFactory = () => AudioContextLike;

/**
 * The bell's meaning is carried by strike COUNT, not by pitch (PR-031). There is
 * exactly ONE bell asset. A single strike says BEGIN (round starts / return to
 * work). The completion of the whole session says STOP with three strikes. A round
 * ending into rest is a single strike too — the same universal bell that opened it.
 */
export type BellKind = 'round-start' | 'rest-start' | 'finish';

/** The single, universal boxing bell. One asset — no personalities, no systems. */
const BELL_ASSET_URL = '/boxing-bell.mp3';
/** "Ding-ding-ding" — the final bell. Spacing between the three closing strikes. */
const FINISH_STRIKE_GAP_SEC = 0.55;
const STRIKES: Record<BellKind, number> = { 'round-start': 1, 'rest-start': 1, finish: 3 };

export interface AudioManagerOptions {
  /** Factory for the AudioContext. `null` ⇒ Web Audio unsupported (all no-ops). */
  readonly createContext?: AudioContextFactory | null;
  readonly onResume?: () => void;
  readonly onAutoplayFailure?: () => void;
  /** Where to fetch the one bell asset from (default `/boxing-bell.mp3`). */
  readonly bellAssetUrl?: string;
  /** Injected asset loader (default `fetch`); lets the manager run headless in tests. */
  readonly loadBellAsset?: BellAssetLoader;
}

export class AudioManager {
  private readonly factory: AudioContextFactory | null;
  private readonly onResume?: () => void;
  private readonly onAutoplayFailure?: () => void;
  private readonly bellAssetUrl: string;
  private readonly loadBellAsset: BellAssetLoader;
  private ctx: AudioContextLike | null = null;
  private unlocked = false;
  /** The decoded bell, loaded once on unlock. Null ⇒ not yet ready (bell stays silent). */
  private bellBuffer: AudioBufferLike | null = null;
  private bellLoad: Promise<void> | null = null;

  constructor(options: AudioManagerOptions = {}) {
    this.factory = options.createContext ?? null;
    this.onResume = options.onResume;
    this.onAutoplayFailure = options.onAutoplayFailure;
    this.bellAssetUrl = options.bellAssetUrl ?? BELL_ASSET_URL;
    this.loadBellAsset =
      options.loadBellAsset ?? ((url) => fetch(url).then((r) => r.arrayBuffer()));
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
    // Load + decode the one bell now that the context is live, so the opening bell
    // is ready before the grace period ends. Idempotent; failure ⇒ silent bell.
    if (this.unlocked) await this.ensureBellLoaded(ctx);
    return this.unlocked;
  }

  /** Fetch + decode the single bell asset exactly once. Safe to call repeatedly. */
  private async ensureBellLoaded(ctx: AudioContextLike): Promise<void> {
    if (this.bellBuffer) return;
    if (!this.bellLoad) {
      this.bellLoad = this.loadBellAsset(this.bellAssetUrl)
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          this.bellBuffer = buffer;
        })
        .catch(() => {
          // A missing/blocked asset must never break the workout — the bell simply
          // stays silent, exactly as it does while audio is locked.
          this.bellLoad = null;
        });
    }
    await this.bellLoad;
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

  /**
   * Ring the one universal boxing bell. A begin (round-start / rest-start) is a
   * single strike; the session's completion is three (ding-ding-ding). Silently
   * no-ops if audio is locked or the asset hasn't loaded yet — the bell is never a
   * blocker, exactly like the old synth.
   */
  playBell(kind: BellKind): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.bellBuffer) return;
    const strikes = STRIKES[kind];
    for (let i = 0; i < strikes; i++) {
      try {
        this.strike(ctx, ctx.currentTime + i * FINISH_STRIKE_GAP_SEC);
      } catch {
        /* one bad strike must not break the workout */
      }
    }
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.unlocked = false;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }

  /** Fire the bell asset once at `when` (seconds, context clock). */
  private strike(ctx: AudioContextLike, when: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.bellBuffer;
    src.connect(ctx.destination);
    src.start(when);
  }
}
