/**
 * CoachSubscriber — the ONLY place coaching is connected to runtime events.
 *
 * It depends on a narrow, event-shaped `Coach` port (not the concrete PR-001
 * CoachEngine), which keeps it trivially testable with a spy and keeps all
 * PR-001 coupling in the `CoachEngineAdapter` (separate file). The subscriber
 * never touches the SpeechService or the Execution Engine.
 */

import type { Subscriber } from '../Subscriber';
import type { WorkoutEvent } from '../types';

/** Event-shaped coaching port. The adapter maps these onto the PR-001 CoachEngine. */
export interface Coach {
  workoutStarted(name: string): void;
  warmupStarted(): void;
  roundStarted(roundNumber: number, roundName: string): void;
  cue(cueId: string, text: string): void;
  countdown(secondsRemaining: number): void;
  restStarted(finishingRoundNumber: number, nextRoundName: string): void;
  completed(totalRounds: number): void;
  paused(): void;
  resumed(): void;
  cancelled(): void;
}

export interface CoachSubscriberOptions {
  /** Display name for the workout (events only carry an id). Falls back to the id. */
  readonly workoutName?: string;
  readonly priority?: number;
}

export const COACH_SUBSCRIBER_ID = 'coach';

export class CoachSubscriber implements Subscriber {
  readonly id = COACH_SUBSCRIBER_ID;
  readonly priority: number;
  private readonly coach: Coach;
  private readonly workoutName?: string;

  constructor(coach: Coach, options: CoachSubscriberOptions = {}) {
    this.coach = coach;
    this.workoutName = options.workoutName;
    // Coaching runs early (before bells/logging) so speech is enqueued promptly.
    this.priority = options.priority ?? 100;
  }

  canHandle(event: WorkoutEvent): boolean {
    switch (event.type) {
      case 'WORKOUT_STARTED':
      case 'WARMUP_STARTED':
      case 'ROUND_STARTED':
      case 'COACH_CUE':
      case 'COUNTDOWN_SECOND':
      case 'REST_STARTED':
      case 'WORKOUT_COMPLETED':
      case 'WORKOUT_CANCELLED':
      case 'WORKOUT_PAUSED':
      case 'WORKOUT_RESUMED':
        return true;
      default:
        return false;
    }
  }

  handle(event: WorkoutEvent): void {
    switch (event.type) {
      case 'WORKOUT_STARTED':
        this.coach.workoutStarted(this.workoutName ?? event.data.workoutId);
        break;
      case 'WARMUP_STARTED':
        this.coach.warmupStarted();
        break;
      case 'ROUND_STARTED':
        this.coach.roundStarted(event.data.roundNumber, event.data.round.name ?? `Round ${event.data.roundNumber}`);
        break;
      case 'COACH_CUE':
        this.coach.cue(event.data.cueId, event.data.text);
        break;
      case 'COUNTDOWN_SECOND':
        this.coach.countdown(event.data.secondsRemaining);
        break;
      case 'REST_STARTED':
        this.coach.restStarted(event.data.nextRoundIndex, event.data.nextRound.name ?? '');
        break;
      case 'WORKOUT_COMPLETED':
        this.coach.completed(event.data.plannedRounds);
        break;
      case 'WORKOUT_CANCELLED':
        this.coach.cancelled();
        break;
      case 'WORKOUT_PAUSED':
        this.coach.paused();
        break;
      case 'WORKOUT_RESUMED':
        this.coach.resumed();
        break;
      default:
        break;
    }
  }
}
