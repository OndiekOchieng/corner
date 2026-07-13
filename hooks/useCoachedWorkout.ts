'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Workout, CoachPack } from '@/types/workout';
import type { WorkoutSnapshot } from '@/src/lib/engine';
import { createHostRuntime, type HostRuntime } from '@/src/lib/host';
import { createCoachRuntimePlugin } from '@/src/lib/coaching';
import { toWorkoutConfig } from '@/src/lib/integration';
import { MediaRuntime, createMediaRuntimePlugin } from '@/src/lib/media';

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
  pause: () => void;
  resume: () => void;
  quit: () => void;
}

type Controller = HostRuntime['controller'];

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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [controller, setController] = useState<Controller | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Build the whole runtime on the client, once per workout. Construction lives
  // inside the effect so a StrictMode remount rebuilds cleanly.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const s = settingsRef.current;
    const media = new MediaRuntime();
    media.configureSpeech(speechSettings(s));
    media.setBellsEnabled(s.bellsEnabled);

    const coach = createCoachRuntimePlugin({
      personality: s.coachPack,
      sink: media.speechSink(),
      workoutName: workout.name,
    });
    const runtime = createHostRuntime(toWorkoutConfig(workout), {
      subscribers: [coach, createMediaRuntimePlugin(media)],
    });

    mediaRef.current = media;
    runtimeRef.current = runtime;
    setController(runtime.controller);
    setIsSupported(media.capabilities().speech);

    // Unlock audio from the (recent) Start gesture, then begin — so the round-one
    // bell isn't dropped by autoplay policy.
    let cancelled = false;
    void media.unlock().finally(() => {
      if (!cancelled) runtime.controller.start();
    });

    return () => {
      cancelled = true;
      runtime.dispose();
      media.dispose();
      runtimeRef.current = null;
      mediaRef.current = null;
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

  return { snapshot, isSupported, pause, resume, quit };
}
