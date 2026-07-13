/**
 * BellSubscriber — STUB (PR-004b).
 *
 * It declares the correct event subscriptions for transition bells but performs
 * NO audio (Web Audio integration is a later PR). An optional `onBell` callback
 * makes the stub observable in tests; by default it does nothing.
 *
 * Bell moments (per EVENT_MODEL): round start, rest start, workout complete, and
 * the final "one second" countdown.
 */

import type { Subscriber } from '../Subscriber';
import type { WorkoutEvent } from '../types';

export type BellKind = 'round-start' | 'rest-start' | 'finish' | 'warning';

export const BELL_SUBSCRIBER_ID = 'bell';

export class BellSubscriber implements Subscriber {
  readonly id = BELL_SUBSCRIBER_ID;
  readonly priority: number;
  private readonly onBell: (kind: BellKind, event: WorkoutEvent) => void;

  constructor(onBell: (kind: BellKind, event: WorkoutEvent) => void = () => {}, priority = 50) {
    this.onBell = onBell;
    this.priority = priority;
  }

  canHandle(event: WorkoutEvent): boolean {
    switch (event.type) {
      case 'ROUND_STARTED':
      case 'REST_STARTED':
      case 'WORKOUT_COMPLETED':
        return true;
      case 'COUNTDOWN_SECOND':
        return event.data.secondsRemaining === 1;
      default:
        return false;
    }
  }

  handle(event: WorkoutEvent): void {
    // STUB: map the event to a bell kind, but do not produce sound.
    switch (event.type) {
      case 'ROUND_STARTED':
        this.onBell('round-start', event);
        break;
      case 'REST_STARTED':
        this.onBell('rest-start', event);
        break;
      case 'WORKOUT_COMPLETED':
        this.onBell('finish', event);
        break;
      case 'COUNTDOWN_SECOND':
        this.onBell('warning', event);
        break;
      default:
        break;
    }
  }
}
