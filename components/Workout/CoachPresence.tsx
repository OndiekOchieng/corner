'use client';

interface CoachPresenceProps {
  /** Voice coaching is enabled and supported. */
  active: boolean;
  paused: boolean;
}

/**
 * A quiet, honest signal that the coach is with the athlete — a small "in your
 * corner" mark with a gentle animated level when the voice is live. Its whole
 * job is to earn the core promise: put the phone down, the coach is talking to
 * you. It never claims a specific named coach the athlete hasn't chosen.
 */
export function CoachPresence({ active, paused }: CoachPresenceProps) {
  const live = active && !paused;

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-4 items-end gap-[3px]"
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${
              live ? 'animate-breathe bg-foreground' : 'bg-muted'
            }`}
            style={{
              height: `${[10, 16, 12][i]}px`,
              animationDelay: `${i * 180}ms`,
              animationDuration: '1800ms',
            }}
          />
        ))}
      </div>
      <span className="eyebrow">
        {active ? (paused ? 'Coach paused' : 'In your corner') : 'Silent'}
      </span>
    </div>
  );
}
