'use client';

import { Round } from '@/types/workout';
import { formatTime } from '@/lib/formatting';

interface RoundPreviewProps {
  rounds: Round[];
}

export function RoundPreview({ rounds }: RoundPreviewProps) {
  return (
    <ol className="space-y-2">
      {rounds.map((round, index) => (
        <li
          key={round.id}
          className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold tabular-nums text-secondary-foreground">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{round.name}</p>
            <p className="truncate text-sm text-muted-foreground">{round.currentDrill}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono font-bold tabular-nums">
              {formatTime(round.drillDuration)}
            </p>
            {round.restDuration > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                +{formatTime(round.restDuration)} rest
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
