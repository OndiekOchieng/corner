/**
 * Headless fakes for every browser media API the Media Runtime touches. These
 * let the whole layer be exercised in Node with zero real browser globals —
 * which also proves there is no browser-API leakage (nothing reads window/
 * navigator directly when dependencies are injected).
 */

import type {
  AudioContextLike,
  OscillatorLike,
  GainNodeLike,
  SpeechEngine,
  WakeLockApiLike,
  WakeLockSentinelLike,
  VisibilityLike,
  GestureTargetLike,
} from '../../lib/media';

export class FakeOscillator implements OscillatorLike {
  frequency = { value: 0 };
  type = '';
  started = false;
  stopped = false;
  connect(): void {}
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
}

export class FakeGain implements GainNodeLike {
  gain = { setValueAtTime(): void {}, exponentialRampToValueAtTime(): void {} };
  connect(): void {}
}

export class FakeAudioContext implements AudioContextLike {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  destination = {};
  readonly oscillators: FakeOscillator[] = [];
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  resumeShouldReject = false;
  /** iOS: resume() can stay pending (never resolves) without a gesture (PR-025). */
  resumeShouldHang = false;

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeShouldReject) throw new Error('autoplay blocked');
    if (this.resumeShouldHang) return new Promise<void>(() => {}); // never resolves
    this.state = 'running';
  }
  async suspend(): Promise<void> {
    this.suspendCalls += 1;
    this.state = 'suspended';
  }
  async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = 'closed';
  }
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
}

export class FakeSpeechEngine implements SpeechEngine {
  readonly spoken: string[] = [];
  paused = false;
  cancelled = 0;
  cleared = 0;
  enabled = true;
  rate = 1;
  pitch = 1;
  volume = 1;
  voiceURI: string | null = null;
  private voices: readonly unknown[];
  private readonly supported: boolean;
  private readonly listeners = new Set<(v: readonly unknown[]) => void>();

  constructor(opts: { supported?: boolean; voices?: readonly unknown[] } = {}) {
    this.supported = opts.supported ?? true;
    this.voices = opts.voices ?? [];
  }

  speak(text: string): void {
    if (this.supported && this.enabled) this.spoken.push(text);
  }
  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  cancel(): void { this.cancelled += 1; }
  clearQueue(): void { this.cleared += 1; }
  isSupported(): boolean { return this.supported; }
  setEnabled(v: boolean): void { this.enabled = v; }
  setRate(v: number): void { this.rate = v; }
  setPitch(v: number): void { this.pitch = v; }
  setVolume(v: number): void { this.volume = v; }
  setVoice(v: string | null): void { this.voiceURI = v; }
  getVoices(): readonly unknown[] { return this.voices; }
  onVoicesChanged(listener: (v: readonly unknown[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emitVoices(voices: readonly unknown[]): void {
    this.voices = voices;
    this.listeners.forEach((l) => l(voices));
  }
}

export class FakeWakeSentinel implements WakeLockSentinelLike {
  released = false;
  private readonly listeners: (() => void)[] = [];
  async release(): Promise<void> {
    this.released = true;
    this.listeners.forEach((l) => l());
  }
  addEventListener(_type: 'release', listener: () => void): void {
    this.listeners.push(listener);
  }
  /** Simulate a browser-initiated release (e.g. the tab was hidden). */
  emitRelease(): void {
    this.released = true;
    this.listeners.forEach((l) => l());
  }
}

export class FakeWakeLock implements WakeLockApiLike {
  requests = 0;
  readonly sentinels: FakeWakeSentinel[] = [];
  requestShouldReject = false;
  async request(_type: 'screen'): Promise<FakeWakeSentinel> {
    this.requests += 1;
    if (this.requestShouldReject) throw new Error('wake lock denied');
    const sentinel = new FakeWakeSentinel();
    this.sentinels.push(sentinel);
    return sentinel;
  }
  get last(): FakeWakeSentinel | undefined {
    return this.sentinels[this.sentinels.length - 1];
  }
}

export class FakeVisibility implements VisibilityLike {
  private state: 'visible' | 'hidden' = 'visible';
  private handlers?: { onVisible: () => void; onHidden: () => void };
  current(): 'visible' | 'hidden' { return this.state; }
  subscribe(handlers: { onVisible: () => void; onHidden: () => void }): () => void {
    this.handlers = handlers;
    return () => { this.handlers = undefined; };
  }
  show(): void { this.state = 'visible'; this.handlers?.onVisible(); }
  hide(): void { this.state = 'hidden'; this.handlers?.onHidden(); }
}

export class FakeGestureTarget implements GestureTargetLike {
  private readonly listeners = new Map<string, (() => void)[]>();
  addEventListener(type: string, cb: () => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(cb);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, cb: () => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((x) => x !== cb));
  }
  fire(type: string): void {
    (this.listeners.get(type) ?? []).slice().forEach((cb) => cb());
  }
  count(type: string): number {
    return (this.listeners.get(type) ?? []).length;
  }
}

/** Flush pending micro/macro tasks so async media work settles. */
export const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
