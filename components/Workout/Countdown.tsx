'use client';

import { formatTime } from '@/lib/formatting';

type CountdownState = 'work' | 'rest' | 'push';

interface CountdownProps {
  remainingSeconds: number;
  /** Sizing preset. `hero` is the full-screen active timer. */
  size?: 'sm' | 'lg' | 'hero';
  /** Phase colour. `push` is the final-10 / urgency red. */
  state?: CountdownState;
  /** Slow breathing scale — used during rest to pace recovery. */
  breathing?: boolean;
  /** One calm pulse per second — used in the final-10 countdown. */
  pulsing?: boolean;
}

const SIZE_CLASS: Record<NonNullable<CountdownProps['size']>, string> = {
  sm: 'text-5xl font-mono font-bold tabular-nums',
  lg: 'timer-lg',
  hero: 'timer-hero',
};

const STATE_CLASS: Record<CountdownState, string> = {
  work: 'text-work',
  rest: 'text-rest',
  push: 'text-push',
};

export function Countdown({
  remainingSeconds,
  size = 'hero',
  state = 'work',
  breathing = false,
  pulsing = false,
}: CountdownProps) {
  const motion = pulsing
    ? 'animate-count-pulse'
    : breathing
      ? 'animate-breathe'
      : '';

  return (
    <div
      role="timer"
      aria-label={`${remainingSeconds} seconds remaining`}
      className={`${SIZE_CLASS[size]} ${STATE_CLASS[state]} ${motion} text-center leading-none transition-colors duration-300`}
    >
      {formatTime(remainingSeconds)}
    </div>
  );
}
