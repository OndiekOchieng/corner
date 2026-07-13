'use client';

import { CoachPresence } from './CoachPresence';
import { RoundNumber } from './RoundNumber';

interface WorkoutHUDProps {
  coachActive: boolean;
  isPaused: boolean;
  currentRound: number;
  totalRounds: number;
  isResting: boolean;
}

/**
 * The active workout's top status bar: coach status on the left, round position
 * on the right. It carries no padding of its own — it lives inside the workout
 * canvas gutter, so its left and right edges align to the same content column as
 * the timer, coach card, and buttons below. Hidden in landscape, where the timer
 * owns the full canvas.
 */
export function WorkoutHUD({
  coachActive,
  isPaused,
  currentRound,
  totalRounds,
  isResting,
}: WorkoutHUDProps) {
  return (
    <header className="flex items-start justify-between gap-4 landscape:hidden">
      <CoachPresence active={coachActive} paused={isPaused} />
      <RoundNumber current={currentRound} total={totalRounds} resting={isResting} />
    </header>
  );
}
