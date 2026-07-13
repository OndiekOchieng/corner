'use client';

import { Countdown } from '@/components/Workout/Countdown';

interface RestScreenProps {
  remainingSeconds: number;
  nextRoundName: string;
}

/**
 * Standalone rest view. The active runner renders rest inline (phase-aware
 * WorkoutScreen); this keeps the same visual language — cool rest colour, a
 * breathing timer that paces recovery, and a clear preview of what's next.
 */
export function RestScreen({ remainingSeconds, nextRoundName }: RestScreenProps) {
  return (
    <div className="screen animate-phase-in flex flex-col items-center justify-center gap-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="eyebrow text-rest">Rest</p>
        <Countdown
          remainingSeconds={remainingSeconds}
          size="lg"
          state="rest"
          breathing
        />
      </div>

      <div className="w-full max-w-md rounded-2xl bg-card px-6 py-5 text-center elevate-1 ring-1 ring-rest/25">
        <p className="eyebrow mb-2 text-rest">Next Round</p>
        <p className="coaching-cue text-balance">{nextRoundName}</p>
      </div>

      <p className="text-sm text-muted-foreground">Breathe. Stay loose.</p>
    </div>
  );
}
