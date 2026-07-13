'use client';

import { Button } from '@/components/ui/button';
import { Pause, Play, X } from 'lucide-react';

interface ControlsProps {
  isPaused: boolean;
  isActive: boolean;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
}

/**
 * Deliberately sparse. Once a workout is running the athlete shouldn't need to
 * touch anything — so the primary control is a single large pause/resume, sized
 * to be hit with a glove (64px targets, well above the 44px minimum). Quit is
 * intentionally quieter and set apart so it isn't tapped by accident.
 */
export function Controls({
  isPaused,
  isActive,
  onPause,
  onResume,
  onQuit,
}: ControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Render the transport toggle while running OR paused — a paused workout
          MUST always offer Resume (status is 'paused', not 'running'). */}
      {(isActive || isPaused) && (
        isPaused ? (
          <Button
            aria-label="Resume workout"
            className="h-16 flex-1 gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90 landscape:h-14 landscape:text-base"
            onClick={onResume}
          >
            <Play className="size-6" />
            Resume
          </Button>
        ) : (
          <Button
            aria-label="Pause workout"
            variant="secondary"
            className="h-16 flex-1 gap-2 rounded-2xl text-lg font-semibold landscape:h-14 landscape:text-base"
            onClick={onPause}
          >
            <Pause className="size-6" />
            Pause
          </Button>
        )
      )}

      <Button
        aria-label="End workout"
        variant="ghost"
        className="h-16 w-16 shrink-0 rounded-2xl text-muted-foreground hover:bg-destructive/15 hover:text-destructive landscape:h-14 landscape:w-14"
        onClick={onQuit}
      >
        <X className="size-6" />
      </Button>
    </div>
  );
}
