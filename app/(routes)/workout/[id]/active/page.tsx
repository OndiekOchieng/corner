'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WorkoutScreen } from '@/components/Workout/WorkoutScreen';
import { LeaveWorkoutGuard } from '@/components/Workout/LeaveWorkoutGuard';
import { WorkoutDiagnostics } from '@/components/dev/WorkoutDiagnostics';
import { useWorkout, usePreferences } from '@/hooks';
import { useCoachedWorkout, type CoachedWorkoutSettings } from '@/hooks/useCoachedWorkout';
import type { Workout } from '@/types/workout';

/**
 * Active workout runner — the whole platform, live.
 *
 *   Engine → Host Runtime → Event Runtime → Coach Runtime → SpeechService
 *
 * The engine drives time and emits events; the Coach Runtime turns those events
 * into intentional speech; this component only renders the engine's snapshot and
 * forwards pause/resume/quit. There is no polling and no second coaching path.
 */
export default function ActiveWorkoutPage() {
  const params = useParams();
  const id = params.id as string;
  const { loadWorkoutById, loading, error } = useWorkout();
  const workout = loadWorkoutById(id);

  if (loading || !workout) {
    return (
      <main className="screen flex items-center justify-center">
        <p className="text-muted-foreground">
          {loading ? 'Loading workout…' : 'Workout not found'}
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="screen flex items-center justify-center">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </div>
      </main>
    );
  }

  return <ActiveRunner workout={workout} />;
}

function ActiveRunner({ workout }: { workout: Workout }) {
  const router = useRouter();
  const { preferences } = usePreferences();

  const settings = useMemo<CoachedWorkoutSettings>(
    () => ({
      speechEnabled: preferences.speechEnabled,
      bellsEnabled: preferences.bellsEnabled,
      voiceRate: preferences.voiceRate,
      voicePitch: preferences.voicePitch,
      volume: preferences.volume,
      voiceURI: preferences.voiceURI,
      coachPack: preferences.coachPack,
    }),
    [
      preferences.speechEnabled,
      preferences.bellsEnabled,
      preferences.voiceRate,
      preferences.voicePitch,
      preferences.volume,
      preferences.voiceURI,
      preferences.coachPack,
    ],
  );

  const { snapshot, isSupported, isPreparing, beginNow, pause, resume, quit, getSessionId, getMediaDiagnostics, getSpeechTrace, getStory } =
    useCoachedWorkout(workout, settings);

  // When the engine finishes, let the closing bell + coach line land, then move
  // to the summary. Data comes from the engine snapshot, not a hand-tracked timer.
  // The session id is carried so the finish screen can attach the athlete's rating
  // to the session the Persistence Subscriber just wrote to History.
  useEffect(() => {
    if (snapshot.phase !== 'finished') return;
    const durationSec = Math.round(snapshot.elapsedMs / 1000);
    const query = new URLSearchParams({
      workoutName: workout.name,
      duration: String(durationSec),
      roundsCompleted: String(snapshot.totalRounds),
      totalRounds: String(snapshot.totalRounds),
    });
    const sessionId = getSessionId();
    if (sessionId) query.set('sessionId', sessionId);
    const timeout = setTimeout(() => router.push(`/finish?${query.toString()}`), 2600);
    return () => clearTimeout(timeout);
  }, [snapshot.phase, snapshot.elapsedMs, snapshot.totalRounds, workout.name, router, getSessionId]);

  const handleQuit = () => {
    quit();
    router.push('/');
  };

  // PR-031 — Grace period: room to arrive. No timer, no countdown, no coaching —
  // just presence, until the opening bell rings and boxing begins. The Leave guard
  // stays active so the athlete can still step out.
  //
  // PR-033 — BEGIN NOW: a quiet escape hatch for the already-prepared athlete. It is
  // NOT the happy path; the bell will ring on its own. It rings the bell immediately
  // for those who have already arrived — one tap, no countdown, no numbers.
  if (isPreparing) {
    return (
      <main className="screen flex flex-col items-center justify-center gap-4 text-center">
        <LeaveWorkoutGuard active onEndWorkout={handleQuit} />
        <p className="eyebrow text-muted-foreground">Get ready</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance">{workout.name}</h1>
        <p className="max-w-xs text-balance text-muted-foreground">
          Put your phone down. Wear your gloves. Take your stance.
        </p>
        <p className="text-sm text-muted-foreground/70">The bell starts your first round.</p>
        {/* Secondary, quiet — the happy path is to simply wait for the bell. */}
        <button
          type="button"
          onClick={beginNow}
          aria-label="Begin now — ring the bell and start the first round"
          className="mt-4 min-h-12 rounded-full px-6 py-3 text-sm font-medium text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Begin now
        </button>
      </main>
    );
  }

  if (snapshot.phase === 'finished') {
    return (
      <main className="screen flex flex-col items-center justify-center gap-3 text-center">
        <p className="eyebrow text-success">Session complete</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance">{workout.name}</h1>
        <p className="text-muted-foreground">Nice work. Bringing up your summary…</p>
      </main>
    );
  }

  const isResting = snapshot.phase === 'rest';
  const roundNumber = Math.min(Math.max(snapshot.roundNumber, 1), workout.rounds.length);
  const round = workout.rounds[roundNumber - 1] ?? workout.rounds[0];
  // During rest the snapshot reports the finishing round; the next one is the
  // following index.
  const nextRoundName = workout.rounds[snapshot.roundNumber]?.name;
  const isActive =
    snapshot.status === 'running' &&
    (snapshot.phase === 'round' || snapshot.phase === 'rest' || snapshot.phase === 'warmup');
  const isPaused = snapshot.status === 'paused';
  const coachActive = settings.speechEnabled && isSupported;

  return (
    <main>
      {/* Protect training: no visible back chrome, but guard OS back / swipe-back /
          refresh so the athlete can't be torn out of a workout by accident. */}
      <LeaveWorkoutGuard active onEndWorkout={handleQuit} />
      {settings.speechEnabled && !isSupported && (
        <div
          role="status"
          className="bg-muted/60 px-4 py-2 text-center text-sm text-muted-foreground"
        >
          Voice coaching isn&apos;t supported in this browser — running as a timer.
        </div>
      )}
      <WorkoutScreen
        round={round}
        currentRound={snapshot.roundNumber}
        totalRounds={snapshot.totalRounds}
        remainingSeconds={snapshot.remainingSeconds}
        isResting={isResting}
        nextRoundName={nextRoundName}
        coachActive={coachActive}
        isPaused={isPaused}
        isActive={isActive}
        onPause={pause}
        onResume={resume}
        onQuit={handleQuit}
      />
      {process.env.NODE_ENV !== 'production' && (
        <WorkoutDiagnostics
          getMediaDiagnostics={getMediaDiagnostics}
          getSpeechTrace={getSpeechTrace}
          getStory={getStory}
          workout={snapshot}
        />
      )}
    </main>
  );
}
