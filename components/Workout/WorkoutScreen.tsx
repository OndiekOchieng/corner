'use client';

import { Countdown } from './Countdown';
import { RoundNumber } from './RoundNumber';
import { CoachingCues } from './CoachingCues';
import { Controls } from './Controls';
import { CoachPresence } from './CoachPresence';
import { Round } from '@/types/workout';

interface WorkoutScreenProps {
  round: Round;
  currentRound: number;
  totalRounds: number;
  remainingSeconds: number;
  /** True while the athlete is in a rest window between rounds. */
  isResting?: boolean;
  /** Name of the round the athlete is about to enter (shown during rest). */
  nextRoundName?: string;
  isPaused: boolean;
  isActive: boolean;
  /** Voice coaching is on and available — the corner is "listening". */
  coachActive?: boolean;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
}

/**
 * The single screen the athlete sees for the whole session. Built to be read
 * from 2–4 m with a phone on the floor and gloves on: one enormous timer, one
 * clear round indicator, one cue. Work and rest are unmistakably different
 * states (colour + label + layout), never the same screen with a new number.
 *
 * Once the workout is running there is nothing to press — the interface gets
 * out of the way so the coach becomes the focus.
 */
export function WorkoutScreen({
  round,
  currentRound,
  totalRounds,
  remainingSeconds,
  isResting = false,
  nextRoundName,
  isPaused,
  isActive,
  coachActive = false,
  onPause,
  onResume,
  onQuit,
}: WorkoutScreenProps) {
  // Final-10 emphasis only during work — rest counting down is calm, not urgent.
  const isCountdown = !isResting && isActive && !isPaused && remainingSeconds <= 10;

  return (
    <div
      key={isResting ? 'rest' : 'work'}
      data-phase={isResting ? 'rest' : 'work'}
      className="screen animate-phase-in flex flex-col justify-between gap-6 p-5 md:p-8 landscape:flex-row landscape:items-center landscape:gap-5 landscape:p-3"
    >
      {/* Top: identity + round position. Minimal, quiet. */}
      <header className="flex items-start justify-between gap-4 landscape:hidden">
        <CoachPresence active={coachActive} paused={isPaused} />
        <RoundNumber
          current={currentRound}
          total={totalRounds}
          resting={isResting}
        />
      </header>

      {/* Center: the timer is the hero. Everything else orbits it. */}
      <section
        className="flex flex-1 flex-col items-center justify-center gap-4 landscape:flex-[1.4]"
        aria-live="off"
      >
        <p
          className={`eyebrow text-sm ${
            isResting ? 'text-rest' : isCountdown ? 'text-push' : ''
          }`}
        >
          {isResting ? 'Rest' : round.name}
        </p>
        {/* Dim the timer while paused so the bright "Paused" label + primary
            Resume button become the focal point. */}
        <div className={isPaused ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
          <Countdown
            remainingSeconds={remainingSeconds}
            state={isResting ? 'rest' : isCountdown ? 'push' : 'work'}
            breathing={isResting}
            pulsing={isCountdown}
          />
        </div>
        {isPaused && (
          <p className="eyebrow animate-cue-in text-base tracking-[0.2em] text-muted-foreground md:tracking-[0.3em]">
            Paused
          </p>
        )}
      </section>

      {/* Bottom: what to do now. During rest, what's coming. */}
      <section className="flex flex-col gap-6 landscape:flex-1 landscape:justify-center">
        {isResting ? (
          <div className="rounded-2xl bg-card px-6 py-5 text-center elevate-1 ring-1 ring-rest/25 landscape:px-4 landscape:py-3">
            <p className="eyebrow mb-2 text-rest">Next Round</p>
            <p className="coaching-cue line-clamp-3 text-balance">
              {nextRoundName ?? 'Final bell soon'}
            </p>
          </div>
        ) : (
          <CoachingCues
            currentCue={round.currentCue}
            nextCue={round.nextCue}
          />
        )}

        <Controls
          isPaused={isPaused}
          isActive={isActive}
          onPause={onPause}
          onResume={onResume}
          onQuit={onQuit}
        />
      </section>
    </div>
  );
}
