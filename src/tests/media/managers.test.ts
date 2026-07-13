import { describe, it, expect } from 'vitest';
import {
  CapabilityService,
  resolveCapabilityEnv,
  AudioManager,
  SpeechManager,
  WakeLockManager,
} from '../../lib/media';
import {
  FakeAudioContext,
  FakeSpeechEngine,
  FakeWakeLock,
  tick,
} from './fakes';

// --- CapabilityService -------------------------------------------------------

describe('CapabilityService — feature detection', () => {
  it('detects each capability from the injected environment', () => {
    const caps = new CapabilityService({
      speechSynthesis: {},
      audioContext: function () {},
      wakeLock: {},
      vibrate: () => true,
      notification: {},
      matchMedia: () => ({ matches: true }),
      visibilitySupported: true,
    }).detect();
    expect(caps).toEqual({
      speech: true,
      webAudio: true,
      wakeLock: true,
      vibration: true,
      notifications: true,
      reducedMotion: true,
      visibility: true,
    });
  });

  it('reports everything false in a bare environment', () => {
    const caps = new CapabilityService({}).detect();
    expect(Object.values(caps).every((v) => v === false)).toBe(true);
  });

  it('resolves a safe empty env under Node (no window)', () => {
    expect(resolveCapabilityEnv()).toEqual({});
  });
});

// --- AudioManager ------------------------------------------------------------

describe('AudioManager — AudioContext ownership & autoplay', () => {
  it('unlocks a suspended context from a gesture', async () => {
    const ctx = new FakeAudioContext();
    const audio = new AudioManager({ createContext: () => ctx });
    expect(audio.isUnlocked()).toBe(false);
    const ok = await audio.unlock();
    expect(ok).toBe(true);
    expect(ctx.state).toBe('running');
    expect(audio.isUnlocked()).toBe(true);
  });

  it('records an autoplay failure when resume is blocked', async () => {
    const ctx = new FakeAudioContext();
    ctx.resumeShouldReject = true;
    let failures = 0;
    const audio = new AudioManager({ createContext: () => ctx, onAutoplayFailure: () => (failures += 1) });
    const ok = await audio.unlock();
    expect(ok).toBe(false);
    expect(failures).toBe(1);
    expect(audio.isUnlocked()).toBe(false);
  });

  it('only makes sound while running (respects the lock)', async () => {
    const ctx = new FakeAudioContext();
    const audio = new AudioManager({ createContext: () => ctx });
    audio.playBell('round-start'); // still suspended
    expect(ctx.oscillators).toHaveLength(0);
    await audio.unlock();
    audio.playBell('round-start'); // two-beep bell
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('is a silent no-op when Web Audio is unsupported', async () => {
    const audio = new AudioManager({ createContext: null });
    expect(audio.isSupported()).toBe(false);
    expect(await audio.unlock()).toBe(false);
    expect(() => audio.playBell('finish')).not.toThrow();
  });

  it('closes the context on dispose', async () => {
    const ctx = new FakeAudioContext();
    const audio = new AudioManager({ createContext: () => ctx });
    await audio.unlock();
    audio.dispose();
    expect(ctx.closeCalls).toBe(1);
    expect(ctx.state).toBe('closed');
  });
});

// --- SpeechManager -----------------------------------------------------------

describe('SpeechManager — speech lifecycle & degradation', () => {
  it('exposes a sink that forwards to the engine', () => {
    const engine = new FakeSpeechEngine();
    const sink = new SpeechManager(engine).sink();
    sink.speak('Jab and move');
    sink.pause();
    sink.resume();
    sink.cancel();
    sink.clearPending();
    expect(engine.spoken).toEqual(['Jab and move']);
    expect(engine.cancelled).toBe(1);
    expect(engine.cleared).toBe(1);
  });

  it('tracks voice readiness as voices load', () => {
    const engine = new FakeSpeechEngine({ voices: [] });
    const mgr = new SpeechManager(engine);
    expect(mgr.isVoicesReady()).toBe(false);
    engine.emitVoices([{ name: 'Voice' }]);
    expect(mgr.isVoicesReady()).toBe(true);
  });

  it('degrades gracefully when speech is unsupported', () => {
    const engine = new FakeSpeechEngine({ supported: false });
    const mgr = new SpeechManager(engine);
    expect(mgr.isAvailable()).toBe(false);
    mgr.sink().speak('Hello'); // no-op
    expect(engine.spoken).toHaveLength(0);
  });

  it('configures the engine from settings', () => {
    const engine = new FakeSpeechEngine();
    new SpeechManager(engine).configure({ enabled: false, rate: 1.4, pitch: 0.9, volume: 0.7, voiceURI: 'v1' });
    expect(engine.enabled).toBe(false);
    expect(engine.rate).toBe(1.4);
    expect(engine.voiceURI).toBe('v1');
  });
});

// --- WakeLockManager ---------------------------------------------------------

describe('WakeLockManager — screen wake lock lifecycle', () => {
  it('acquires and releases', async () => {
    const api = new FakeWakeLock();
    const wl = new WakeLockManager({ api });
    expect(wl.getStatus()).toBe('released');
    await wl.acquire();
    expect(api.requests).toBe(1);
    expect(wl.getStatus()).toBe('active');
    await wl.release();
    expect(api.last?.released).toBe(true);
    expect(wl.getStatus()).toBe('released');
  });

  it('reacquires after a browser-initiated release', async () => {
    const api = new FakeWakeLock();
    const wl = new WakeLockManager({ api });
    await wl.acquire();
    api.last!.emitRelease(); // tab hidden → browser drops the lock
    expect(wl.getStatus()).toBe('released');
    await wl.reacquireIfWanted();
    expect(api.requests).toBe(2);
    expect(wl.getStatus()).toBe('active');
  });

  it('does not reacquire once released on purpose', async () => {
    const api = new FakeWakeLock();
    const wl = new WakeLockManager({ api });
    await wl.acquire();
    await wl.release();
    await wl.reacquireIfWanted();
    expect(api.requests).toBe(1);
  });

  it('degrades to unsupported without the API', async () => {
    const wl = new WakeLockManager({ api: null });
    expect(wl.isSupported()).toBe(false);
    expect(await wl.acquire()).toBe(false);
    expect(wl.getStatus()).toBe('unsupported');
  });

  it('survives a denied request (retryable)', async () => {
    const api = new FakeWakeLock();
    api.requestShouldReject = true;
    const wl = new WakeLockManager({ api });
    expect(await wl.acquire()).toBe(false);
    expect(wl.getStatus()).toBe('released');
    api.requestShouldReject = false;
    await wl.reacquireIfWanted();
    expect(wl.getStatus()).toBe('active');
  });
});

// A stray tick import guard so the helper is referenced even if a test is removed.
void tick;
