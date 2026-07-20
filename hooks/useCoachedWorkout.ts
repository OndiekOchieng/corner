'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Workout, CoachPack } from '@/types/workout';
import type { WorkoutSnapshot } from '@/src/lib/engine';
import { createHostRuntime, type HostRuntime } from '@/src/lib/host';
import { createCoachRuntimePlugin, type CoachRuntimePlugin, type CoachDiagnosticsSnapshot } from '@/src/lib/coaching';
import { toWorkoutConfig, createSessionRepository } from '@/src/lib/integration';
import { PersistenceSubscriber } from '@/src/lib/session';
import { FlightRecorder } from '@/src/lib/recorder';
import {
  MediaRuntime,
  createMediaRuntimePlugin,
  type MediaDiagnosticsSnapshot,
  type SpeechTraceSnapshot,
} from '@/src/lib/media';

/** Combined speech-pipeline trace for the dev overlay (PR-014). */
export interface SpeechPipelineTrace {
  coach: CoachDiagnosticsSnapshot | null;
  media: SpeechTraceSnapshot | null;
}

export interface CoachedWorkoutSettings {
  speechEnabled: boolean;
  bellsEnabled: boolean;
  voiceRate: number;
  voicePitch: number;
  volume: number;
  voiceURI: string | null;
  coachPack: CoachPack;
}

export interface UseCoachedWorkoutReturn {
  snapshot: WorkoutSnapshot;
  isSupported: boolean;
  /** True during the pre-workout grace period (PR-031) — before the opening bell. */
  isPreparing: boolean;
  pause: () => void;
  resume: () => void;
  quit: () => void;
  /** The live session id (for attaching a rating on the finish screen). */
  getSessionId: () => string | null;
  /** Live Media Runtime diagnostics (dev-only overlay). */
  getMediaDiagnostics: () => MediaDiagnosticsSnapshot | null;
  /** Live speech-pipeline trace: coach + speech boundary counters (dev-only). */
  getSpeechTrace: () => SpeechPipelineTrace;
  /** The workout's story so far, as markdown — Flight Recorder (dev-only, PR-032). */
  getStory: () => string;
}

type Controller = HostRuntime['controller'];

/**
 * PR-031 — Grace period. After START, the athlete gets room to put the phone down,
 * wear their gloves, take their stance, and become present. Nothing is timed and
 * nothing is spoken; the Engine is started only when this ends, so its first truth
 * is still the opening bell of round one — it never learns the grace existed.
 */
const GRACE_PERIOD_MS = 15000;

/** Idle snapshot used before the runtime exists (SSR / first paint). */
const IDLE_SNAPSHOT: WorkoutSnapshot = {
  phase: 'idle',
  status: 'running',
  roundIndex: -1,
  roundNumber: 0,
  totalRounds: 0,
  remainingMs: 0,
  remainingSeconds: 0,
  elapsedMs: 0,
  phaseDurationMs: 0,
  progress: 0,
};

function speechSettings(s: CoachedWorkoutSettings) {
  return {
    enabled: s.speechEnabled,
    rate: s.voiceRate,
    pitch: s.voicePitch,
    volume: s.volume,
    voiceURI: s.voiceURI,
  };
}

/**
 * Read the time of day at the browser edge so the Coach Runtime never touches a
 * clock (determinism). The coach receives this as injected data (PR-020B).
 */
function timeOfDayNow(): 'morning' | 'afternoon' | 'evening' | 'neutral' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'neutral';
}

/**
 * Build the cue-id → combination lookup from the workout's authored cues (PR-020D).
 * Keyed by the same cue id the engine emits on COACH_CUE, so the Coach Runtime can
 * recognise a combination cue without the engine ever knowing about it.
 */
function buildCombinations(workout: Workout): ReadonlyMap<string, readonly number[]> {
  const map = new Map<string, readonly number[]>();
  for (const round of workout.rounds) {
    for (const cue of round.coachingCues ?? []) {
      if (cue.combination && cue.combination.length > 0) {
        map.set(cue.id, cue.combination);
      }
    }
  }
  return map;
}

/**
 * The live wiring: run the real Execution Engine (Host Runtime), publish its
 * events to the Event Runtime, let the Coach Runtime decide, and let the Media
 * Runtime actually reach the browser — speech, bells, wake lock, visibility.
 *
 *   Engine → Host Runtime → Event Runtime → Coach Runtime → Media Runtime → browser
 *
 * All browser concerns live in the Media Runtime; this hook only composes and
 * forwards. Audio is unlocked (from the near-Start gesture) before the engine
 * starts, so the first bell is never lost to autoplay policy.
 */
export function useCoachedWorkout(
  workout: Workout,
  settings: CoachedWorkoutSettings,
): UseCoachedWorkoutReturn {
  const runtimeRef = useRef<HostRuntime | null>(null);
  const mediaRef = useRef<MediaRuntime | null>(null);
  const coachRef = useRef<CoachRuntimePlugin | null>(null);
  const recorderRef = useRef<FlightRecorder | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [controller, setController] = useState<Controller | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  /** True during the grace period — before the opening bell and engine t=0 (PR-031). */
  const [isPreparing, setIsPreparing] = useState(true);

  // Build the whole runtime on the client, once per workout. Construction lives
  // inside the effect so a StrictMode remount rebuilds cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const s = settingsRef.current;
    const media = new MediaRuntime();
    media.configureSpeech(speechSettings(s));
    media.setBellsEnabled(s.bellsEnabled);

    // Flight Recorder (PR-032): a parasitic observer of the workout's own story. It
    // owns nothing — it decorates the coach's sink to hear what was actually said,
    // and registers on the bus below to hear the workout's shape. Dev-only surface.
    const recorder = new FlightRecorder(workout.name);

    // Build the engine config ONCE and share it with the coach, so the coach's
    // countdown-preemption thresholds are the same ones the engine schedules
    // against (PR-022) — a single source of truth per workout.
    const workoutConfig = toWorkoutConfig(workout);

    const coach = createCoachRuntimePlugin({
      personality: s.coachPack,
      // The recorder decorates the sink transparently — it hears every spoken line
      // and forwards each call unchanged (it observes, it never controls).
      sink: recorder.observeSpeech(media.speechSink()),
      workoutName: workout.name,
      // Countdown thresholds derived from the same engine config (PR-022).
      // undefined ⇒ the coach falls back to the engine default.
      countdownLeadSeconds: workoutConfig.countdownLeadSeconds,
      // Workout facts + injected time of day for the session introduction (PR-020B).
      // Time is read HERE (the browser edge) and passed in — the Coach Runtime
      // never reads a clock, so its output stays deterministic.
      facts: {
        focus: workout.focus,
        objective: workout.objective,
        timeOfDay: timeOfDayNow(),
      },
      // Semantic combination metadata (PR-020D), keyed by cue id — the engine
      // still schedules cues by id/text exactly as today; the coach looks the
      // combination up here so it can render it per pack. No Engine change.
      combinations: buildCombinations(workout),
    });
    const runtime = createHostRuntime(workoutConfig, {
      subscribers: [coach, createMediaRuntimePlugin(media)],
    });

    // Persistence: the existing Session Runtime, wired as an event subscriber.
    // It checkpoints the active session and moves a completed one to History.
    // Registered before start() so it catches WORKOUT_STARTED. The coach pack is
    // captured now so History can show who coached this session.
    const persistence = new PersistenceSubscriber(
      createSessionRepository(),
      () => runtime.controller.getSession(),
      {
        // Wall-clock so History can show the real completed date; fine for the
        // 1s checkpoint debounce.
        now: () => Date.now(),
        meta: () => ({ rating: null, notes: null, coach: s.coachPack }),
      },
    );
    runtime.eventBus.register(persistence);
    // Highest priority (1000) so it stamps the moment before anyone reacts; it never
    // mutates events and produces no side effects on the runtime.
    runtime.eventBus.register(recorder);

    mediaRef.current = media;
    coachRef.current = coach;
    recorderRef.current = recorder;
    runtimeRef.current = runtime;
    setController(runtime.controller);
    setIsSupported(media.capabilities().speech);

    // Unlock audio NOW (best-effort) so the opening bell — rung by the Engine at
    // t=0 — is audible when the grace period ends. Unlocking is never awaited; on
    // iOS AudioContext.resume() can stay pending until a gesture, and the Media
    // Runtime arms a one-shot gesture fallback + re-attempts on WORKOUT_STARTED.
    void media.unlock();
    setIsPreparing(true);

    // PR-031 — Grace period: 15 s of silence to arrive, then the Engine starts and
    // its first event (ROUND_STARTED) rings the opening bell. The Engine is never
    // told the grace happened; from its side, the bell rang and t=0 began.
    const graceTimer = window.setTimeout(() => {
      setIsPreparing(false);
      runtime.controller.start();
    }, GRACE_PERIOD_MS);

    return () => {
      window.clearTimeout(graceTimer);
      runtime.dispose();
      media.dispose();
      runtimeRef.current = null;
      mediaRef.current = null;
      coachRef.current = null;
      recorderRef.current = null;
      setController(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.id]);

  // Keep media/speech settings live (no rebuild required).
  useEffect(() => {
    mediaRef.current?.configureSpeech(speechSettings(settings));
  }, [settings.speechEnabled, settings.voiceRate, settings.voicePitch, settings.volume, settings.voiceURI]);

  useEffect(() => {
    mediaRef.current?.setBellsEnabled(settings.bellsEnabled);
  }, [settings.bellsEnabled]);

  const subscribe = useCallback(
    (cb: () => void) => (controller ? controller.subscribe(cb) : () => {}),
    [controller],
  );
  const getSnapshot = useCallback(
    () => (controller ? controller.getSnapshot() : IDLE_SNAPSHOT),
    [controller],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => IDLE_SNAPSHOT);

  const pause = useCallback(() => runtimeRef.current?.controller.pause(), []);
  const resume = useCallback(() => runtimeRef.current?.controller.resume(), []);
  const quit = useCallback(() => runtimeRef.current?.controller.cancel(), []);
  const getSessionId = useCallback(
    () => runtimeRef.current?.controller.getSession().id ?? null,
    [],
  );
  const getMediaDiagnostics = useCallback(() => mediaRef.current?.diagnostics() ?? null, []);
  const getSpeechTrace = useCallback<() => SpeechPipelineTrace>(
    () => ({
      coach: coachRef.current?.diagnostics() ?? null,
      media: mediaRef.current?.speechTrace() ?? null,
    }),
    [],
  );
  /** The story of this workout so far, as markdown (dev-only; PR-032). */
  const getStory = useCallback(() => recorderRef.current?.export() ?? '', []);

  return {
    snapshot,
    isSupported,
    isPreparing,
    pause,
    resume,
    quit,
    getSessionId,
    getMediaDiagnostics,
    getSpeechTrace,
    getStory,
  };
}
