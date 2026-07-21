import { describe, it, expect } from 'vitest';
import {
  summarizeWorkout,
  buildDevWorkoutStory,
  captureDevWorkoutStory,
  getDevWorkoutStory,
  type DevStoryInputs,
} from '../../lib/recorder';
import type { CoachDiagnosticsSnapshot } from '../../lib/coaching';
import type { MediaDiagnosticsSnapshot, SpeechServiceStats } from '../../lib/media';

const coach = (o: Partial<CoachDiagnosticsSnapshot> = {}): CoachDiagnosticsSnapshot =>
  ({ actionsGenerated: 42, actionsSpoken: 42, actionsDiscarded: 1, silenceDecisions: 5, interruptions: 0, repetitionAvoided: 0, queueDepth: 0, ...o }) as CoachDiagnosticsSnapshot;
const speech = (o: Partial<SpeechServiceStats> = {}): SpeechServiceStats =>
  ({ instanceId: 1, speakCalls: 42, synthSpeakCalls: 42, started: 42, ended: 41, errors: 0, queueLength: 0, speaking: false, ...o }) as SpeechServiceStats;
const media = (o: Partial<MediaDiagnosticsSnapshot> = {}): MediaDiagnosticsSnapshot =>
  ({
    wakeLockSupported: true,
    wakeLockStatus: 'released',
    wakeLockHeld: false,
    wakeLockRequested: 1,
    wakeLockAcquired: 1,
    wakeLockReleased: 0,
    wakeLockReacquired: 0,
    wakeLockHeldDurationMs: 1083000,
    ...o,
  }) as MediaDiagnosticsSnapshot;

const base: DevStoryInputs = {
  title: 'Orthodox Power',
  storyMarkdown: '# Workout Story\n- `0:04` Opening bell. Round 1.\n- `0:19` Bell. Round 2.\n- `0:46` Final bell. Workout complete.',
  storyJson: '{}',
  coach: coach(),
  media: media(),
  speech: speech(),
};

describe('Developer Workout Story — summarizeWorkout (pure)', () => {
  it('a healthy session reads all green', () => {
    const v = summarizeWorkout(base);
    const byLabel = Object.fromEntries(v.map((x) => [x.label, x]));
    expect(byLabel['Speech']?.status).toBe('ok');
    expect(byLabel['Speech']?.detail).toContain('42/42 started');
    expect(byLabel['Coach']?.status).toBe('ok');
    expect(byLabel['Coach']?.detail).toBe('42/42 spoken · 1 discarded');
    expect(byLabel['Wake lock']?.status).toBe('ok');
    expect(byLabel['Wake lock']?.detail).toContain('held throughout');
    expect(byLabel['Visibility']?.detail).toBe('0 interruptions');
    // 3 bell lines in the story → "3 rings"
    expect(byLabel['Bell']?.status).toBe('ok');
    expect(byLabel['Bell']?.detail).toBe('3 rings');
  });

  it('flags speech that reached the browser but never started (the silent-drop signature)', () => {
    const v = summarizeWorkout({ ...base, speech: speech({ synthSpeakCalls: 42, started: 30, errors: 0 }) });
    const s = v.find((x) => x.label === 'Speech')!;
    expect(s.status).toBe('warn');
    expect(s.detail).toContain('unheard');
  });

  it('flags a wake lock that released without recovering, and counts interruptions', () => {
    const v = summarizeWorkout({ ...base, media: media({ wakeLockReleased: 3, wakeLockReacquired: 1 }) });
    const byLabel = Object.fromEntries(v.map((x) => [x.label, x]));
    expect(byLabel['Wake lock']?.status).toBe('warn');
    expect(byLabel['Wake lock']?.detail).toContain('3 releases');
    expect(byLabel['Visibility']?.detail).toBe('1 interruption');
  });

  it('reports unsupported wake lock as off (platform), not a failure', () => {
    const v = summarizeWorkout({ ...base, media: media({ wakeLockSupported: false }) });
    const w = v.find((x) => x.label === 'Wake lock')!;
    expect(w.status).toBe('off');
    expect(w.detail).toContain('unsupported');
  });

  it('is a projection — degrades gracefully when a source is missing', () => {
    const v = summarizeWorkout({ ...base, speech: null, coach: null, media: null });
    expect(v.find((x) => x.label === 'Speech')?.status).toBe('off');
    expect(v.some((x) => x.label === 'Coach')).toBe(false); // no coach data → no coach line
    expect(v.find((x) => x.label === 'Bell')).toBeTruthy(); // bell still derived from the story
  });
});

describe('Developer Workout Story — in-memory holder (no persistence)', () => {
  it('captures at finish and hands off exactly one story', () => {
    captureDevWorkoutStory(base);
    const held = getDevWorkoutStory();
    expect(held?.title).toBe('Orthodox Power');
    expect(held?.verdicts.length).toBeGreaterThan(0);
    // A new capture overwrites the last (single-slot handoff).
    captureDevWorkoutStory({ ...base, title: 'Southpaw' });
    expect(getDevWorkoutStory()?.title).toBe('Southpaw');
  });

  it('buildDevWorkoutStory carries the full narrative alongside the digest', () => {
    const s = buildDevWorkoutStory(base);
    expect(s.storyMarkdown).toContain('Opening bell');
    expect(s.verdicts.some((v) => v.label === 'Speech')).toBe(true);
  });
});
