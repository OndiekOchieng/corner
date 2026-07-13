'use client';

interface RoundNumberProps {
  current: number;
  total: number;
  /** During rest, dim the position and show it as "up next". */
  resting?: boolean;
}

/**
 * Round position, readable at a glance from across the room. A compact numeric
 * pill plus a progress track so the athlete always knows how far in they are
 * without reading small text.
 */
export function RoundNumber({ current, total, resting = false }: RoundNumberProps) {
  const safeTotal = Math.max(total, 1);
  const clamped = Math.min(Math.max(current, 1), safeTotal);

  return (
    <div className="flex flex-col items-end gap-2.5">
      <div className="flex items-baseline gap-2">
        <span className="eyebrow">{resting ? 'Up Next' : 'Round'}</span>
        <span
          className={`text-2xl font-bold tabular-nums leading-none ${
            resting ? 'text-rest' : 'text-foreground'
          }`}
        >
          {clamped}
        </span>
        <span className="text-lg font-medium tabular-nums text-muted-foreground">
          / {safeTotal}
        </span>
      </div>

      {/* Progress track — dots when few rounds, a bar when many. */}
      {safeTotal <= 10 ? (
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: safeTotal }, (_, i) => {
            const done = i < clamped - 1;
            const active = i === clamped - 1;
            return (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active
                    ? resting
                      ? 'w-6 bg-rest'
                      : 'w-6 bg-foreground'
                    : done
                      ? 'w-1.5 bg-foreground/60'
                      : 'w-1.5 bg-muted'
                }`}
              />
            );
          })}
        </div>
      ) : (
        <div
          className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              resting ? 'bg-rest' : 'bg-foreground'
            }`}
            style={{ width: `${(clamped / safeTotal) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
