import { describe, it, expect } from 'vitest';
import { MediaRuntime, createMediaRuntimePlugin, MEDIA_RUNTIME_SUBSCRIBER_ID } from '../../lib/media';
import type { MediaRuntimeDeps } from '../../lib/media';
import { EventBus } from '../../lib/runtime';
import { createCoachRuntimePlugin } from '../../lib/coaching';
import { fullWorkoutEvents } from '../coaching/helpers';
import {
  FakeAudioContext,
  FakeSpeechEngine,
  FakeWakeLock,
  FakeVisibility,
  FakeGestureTarget,
  tick,
} from './fakes';

function build(overrides: Partial<MediaRuntimeDeps> = {}) {
  const ctx = new FakeAudioContext();
  const engine = new FakeSpeechEngine();
  const wakeLock = new FakeWakeLock();
  const visibility = new FakeVisibility();
  const gesture = new FakeGestureTarget();
  const media = new MediaRuntime({
    capabilityEnv: { speechSynthesis: {}, audioContext: function () {}, wakeLock: {}, visibilitySupported: true },
    audioContextFactory: () => ctx,
    speechEngine: engine,
    wakeLockApi: wakeLock,
    visibility,
    gestureTarget: gesture,
    ...overrides,
  });
  return { media, ctx, engine, wakeLock, visibility, gesture };
}

const STARTED = { type: 'WORKOUT_STARTED', at: 0, elapsedMs: 0, seq: 1, data: { workoutId: 'w', totalRounds: 3, plannedDurationMs: 1000, hasWarmup: false } } as const;
const ROUND = { type: 'ROUND_STARTED', at: 0, elapsedMs: 0, seq: 2, data: { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Jab', workMs: 1000, restMs: 0, cues: [] }, durationMs: 1000 } } as const;
const COMPLETED = { type: 'WORKOUT_COMPLETED', at: 1000, elapsedMs: 1000, seq: 3, data: { id: 's', workoutId: 'w', status: 'completed', plannedRounds: 3, plannedDurationMs: 1000 } } as never;

describe('MediaRuntime — lifecycle, bells, wake lock', () => {
  it('acquires the wake lock and resumes audio on start', async () => {
    const { media, ctx, wakeLock } = build();
    media.onEvent(STARTED);
    await tick();
    expect(ctx.state).toBe('running');
    expect(wakeLock.requests).toBe(1);
    expect(media.diagnostics().wakeLockStatus).toBe('active');
  });

  it('rings bells on transitions once unlocked', async () => {
    const { media, ctx } = build();
    await media.unlock();
    media.onEvent(ROUND); // two-beep round bell
    expect(ctx.oscillators).toHaveLength(2);
  });

  it('respects the bells-enabled toggle', async () => {
    const { media, ctx } = build();
    await media.unlock();
    media.setBellsEnabled(false);
    media.onEvent(ROUND);
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('rings the finish bell and releases the wake lock on completion', async () => {
    const { media, ctx, wakeLock } = build();
    await media.unlock();
    media.onEvent(STARTED);
    await tick();
    media.onEvent(COMPLETED);
    await tick();
    expect(ctx.oscillators.length).toBeGreaterThanOrEqual(3); // finish = 3 tones
    expect(wakeLock.last?.released).toBe(true);
    expect(media.diagnostics().wakeLockStatus).toBe('released');
  });
});

describe('MediaRuntime — execution continuity', () => {
  it('reacquires the wake lock and resumes audio when the page returns', async () => {
    const { media, ctx, wakeLock, visibility } = build();
    await media.unlock();
    media.onEvent(STARTED);
    await tick();

    // Tab hidden: the browser drops the lock and suspends audio.
    wakeLock.last!.emitRelease();
    ctx.state = 'suspended';
    visibility.hide();
    expect(media.diagnostics().visibility).toBe('hidden');

    // Back to visible: reacquire + resume.
    visibility.show();
    await tick();
    expect(wakeLock.requests).toBe(2);
    expect(ctx.state).toBe('running');
    expect(media.diagnostics().visibility).toBe('visible');
    expect(media.diagnostics().resumeCount).toBeGreaterThan(0);
  });

  it('arms a one-shot gesture unlock when autoplay is blocked, then unlocks', async () => {
    const { media, ctx, gesture } = build();
    ctx.resumeShouldReject = true;
    media.onEvent(STARTED); // begin() tries to resume, fails, arms the gesture
    await tick();
    expect(media.diagnostics().audioUnlocked).toBe(false);
    expect(gesture.count('pointerdown')).toBe(1);

    ctx.resumeShouldReject = false;
    gesture.fire('pointerdown'); // the athlete taps → audio unlocks
    await tick();
    expect(ctx.state).toBe('running');
    expect(media.diagnostics().audioUnlocked).toBe(true);
  });
});

describe('MediaRuntime — capabilities, diagnostics, degradation', () => {
  it('exposes an immutable capability + diagnostics snapshot', () => {
    const { media } = build();
    expect(media.capabilities().speech).toBe(true);
    const d = media.diagnostics();
    expect(d.audioSupported).toBe(true);
    expect(d.speechAvailable).toBe(true);
    expect(d.browserCompatibility).toBe('full');
  });

  it('exposes a speech-pipeline trace with a stable manager identity', () => {
    const { media } = build();
    const t = media.speechTrace();
    expect(t.speechManagerId).toBeGreaterThan(0);
    // The fake engine has no stats()/instanceId; the real SpeechService supplies them.
    expect(t.service).toBeNull();
    expect(t.speechManagerId).toBe(media.speechTrace().speechManagerId); // stable
  });

  it('surfaces live audio/voice state for the compatibility audit', async () => {
    const ctx = new FakeAudioContext();
    const media = new MediaRuntime({
      capabilityEnv: { speechSynthesis: {}, audioContext: function () {}, wakeLock: {}, visibilitySupported: true },
      audioContextFactory: () => ctx,
      speechEngine: new FakeSpeechEngine({ voices: [{ name: 'Alex' }, { name: 'Sam' }] }),
      wakeLockApi: null,
      visibility: null,
      gestureTarget: null,
    });
    expect(media.diagnostics().audioState).toBe('none'); // context not created yet
    expect(media.diagnostics().voiceCount).toBe(2); // voices enumerated
    await media.unlock();
    const d = media.diagnostics();
    expect(d.audioState).toBe('running'); // unlocked
    expect(d.audioUnlocked).toBe(true);
  });

  it('degrades safely with no browser APIs at all', async () => {
    const media = new MediaRuntime({
      capabilityEnv: {},
      audioContextFactory: null,
      speechEngine: new FakeSpeechEngine({ supported: false }),
      wakeLockApi: null,
      visibility: null,
      gestureTarget: null,
    });
    expect(await media.unlock()).toBe(false);
    expect(() => { media.onEvent(STARTED); media.onEvent(ROUND); media.onEvent(COMPLETED); }).not.toThrow();
    const d = media.diagnostics();
    expect(d.audioSupported).toBe(false);
    expect(d.speechAvailable).toBe(false);
    expect(d.wakeLockStatus).toBe('unsupported');
    expect(d.browserCompatibility).toBe('minimal');
    expect(() => media.dispose()).not.toThrow();
  });
});

describe('MediaRuntimePlugin — the athlete hears a full workout', () => {
  it('drives speech + bells + wake lock off the real event stream', async () => {
    const { media, ctx, engine, wakeLock } = build();
    media.configureSpeech({ enabled: true, rate: 1, pitch: 1, volume: 1, voiceURI: null });
    await media.unlock(); // gesture, before the first bell — avoids the async-resume race

    const bus = new EventBus();
    bus.register(createCoachRuntimePlugin({ personality: 'fightnight', sink: media.speechSink(), workoutName: 'Test Bout' }));
    bus.register(createMediaRuntimePlugin(media));

    bus.publishAll(fullWorkoutEvents());
    await tick();

    expect(engine.spoken[0]).toContain('Test Bout'); // coach spoke
    expect(engine.spoken.join(' ')).toContain('Ten seconds.'); // countdown heard
    expect(ctx.oscillators.length).toBeGreaterThan(0); // bells rang
    expect(wakeLock.requests).toBeGreaterThanOrEqual(1); // screen kept awake
    expect(wakeLock.last?.released).toBe(true); // released at the end
  });

  it('the plugin only handles lifecycle + bell events', () => {
    const { media } = build();
    const plugin = createMediaRuntimePlugin(media);
    expect(plugin.id).toBe(MEDIA_RUNTIME_SUBSCRIBER_ID);
    expect(plugin.canHandle(ROUND)).toBe(true);
    expect(plugin.canHandle({ type: 'COUNTDOWN_SECOND', at: 0, elapsedMs: 0, seq: 9, data: { context: 'round', secondsRemaining: 5 } })).toBe(false);
  });
});
