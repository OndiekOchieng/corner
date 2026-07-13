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
 * One decision at a time. While the workout runs, the only control is a single
 * full-width PAUSE — nothing else to hit with a glove, and no way to quit by
 * accident. Pausing reveals RESUME (primary) stacked above END WORKOUT, so the
 * two critical actions are never side by side on a narrow phone. Every target is
 * a comfortable full-width block, 48–64px tall, easy to hit with gloves on.
 */
export function Controls({
  isPaused,
  isActive,
  onPause,
  onResume,
  onQuit,
}: ControlsProps) {
  if (isPaused) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          aria-label="Resume workout"
          className="h-16 w-full gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90 landscape:h-14"
          onClick={onResume}
        >
          <Play className="size-6" />
          Resume
        </Button>
        <Button
          aria-label="End workout"
          variant="destructive"
          className="h-14 w-full gap-2 rounded-2xl text-base font-semibold landscape:h-12"
          onClick={onQuit}
        >
          <X className="size-5" />
          End workout
        </Button>
      </div>
    );
  }

  if (isActive) {
    return (
      <Button
        aria-label="Pause workout"
        variant="secondary"
        className="h-16 w-full gap-2 rounded-2xl text-lg font-semibold landscape:h-14"
        onClick={onPause}
      >
        <Pause className="size-6" />
        Pause
      </Button>
    );
  }

  return null;
}
