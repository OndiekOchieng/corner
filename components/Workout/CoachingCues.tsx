'use client';

import { DrillCue } from '@/types/workout';

interface CoachingCuesProps {
  currentCue: DrillCue;
  nextCue?: DrillCue;
}

/**
 * The one thing to do right now, large and legible, with a quiet preview of
 * what's coming. The visible cue mirrors what the coach is saying — it is a
 * caption for the voice, never the primary channel (this app is hands-free
 * first). Kept deliberately minimal so it reads at a glance mid-round.
 */
export function CoachingCues({ currentCue, nextCue }: CoachingCuesProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        key={currentCue.id ?? currentCue.text}
        className="animate-cue-in rounded-2xl bg-card px-6 py-5 ring-1 ring-foreground/10 elevate-1 landscape:px-4 landscape:py-3"
      >
        <p className="eyebrow mb-2">Coach</p>
        <p className="coaching-cue line-clamp-3">{currentCue.text}</p>
      </div>

      {nextCue && (
        <div className="flex items-center gap-2 px-1 text-muted-foreground">
          <span className="eyebrow shrink-0">Next</span>
          <p className="truncate text-sm font-medium">{nextCue.text}</p>
        </div>
      )}
    </div>
  );
}
