/**
 * CoachEngineAdapter — implements the event-shaped `Coach` port by delegating to
 * the existing PR-001 `CoachEngine`. This is the SINGLE point of coupling between
 * the runtime and the speech stack.
 *
 * It lives in the `integration` layer (moved here in PR-004d) rather than inside
 * the generic `runtime` package: `runtime` must stay app-agnostic, and this
 * adapter is Corner-specific (it imports the app's speech stack and `Round` type).
 * The `CoachSubscriber` + `Coach` port remain in `runtime` because they are
 * generic (they depend only on events + the port).
 *
 * High-level announcements reuse CoachEngine's composed methods (they speak
 * several phrases and keep their own idempotency). Already-resolved content
 * (cue text, countdown wording) goes through `CoachEngine.say()` — the engine
 * has already scheduled and de-duplicated those, so the polling
 * `handleCues`/`handleCountdown` methods (which carry cross-round dedup) are
 * intentionally not used here.
 *
 * The SpeechService and the Execution Engine are untouched.
 */

import type { Round } from '@/types/workout';
import { CoachEngine } from '@/lib/speech/CoachEngine';
import { capitalize, numberToWords } from '@/lib/speech/phrases';
import type { Coach } from '../runtime';

/** Build a minimal app `Round` carrying just the name (the round intro needs it). */
function toAppRound(name: string): Round {
  return {
    id: '',
    name,
    drillDuration: 0,
    restDuration: 0,
    currentDrill: '',
    currentCue: { id: '', text: '' },
    coachingCues: [],
  };
}

function countdownPhrase(secondsRemaining: number): string {
  return secondsRemaining === 10 ? 'Ten seconds.' : `${capitalize(numberToWords(secondsRemaining))}.`;
}

export class CoachEngineAdapter implements Coach {
  private readonly engine: CoachEngine;

  constructor(engine: CoachEngine) {
    this.engine = engine;
  }

  workoutStarted(name: string): void {
    this.engine.announceWorkoutStart({ name });
  }

  warmupStarted(): void {
    this.engine.announceWarmup();
  }

  roundStarted(roundNumber: number, roundName: string): void {
    this.engine.announceRound(toAppRound(roundName), roundNumber);
  }

  cue(_cueId: string, text: string): void {
    this.engine.say(text);
  }

  countdown(secondsRemaining: number): void {
    this.engine.say(countdownPhrase(secondsRemaining));
  }

  restStarted(finishingRoundNumber: number, nextRoundName: string): void {
    this.engine.announceRest(finishingRoundNumber, nextRoundName || undefined);
  }

  completed(totalRounds: number): void {
    this.engine.announceComplete(totalRounds);
  }

  paused(): void {
    this.engine.pause();
  }

  resumed(): void {
    this.engine.resume();
  }

  cancelled(): void {
    this.engine.reset();
  }
}
