/**
 * Subscriber contract.
 *
 * A subscriber reacts to domain events emitted by the Execution Engine. It knows
 * nothing about other subscribers, nothing about the engine's internals, and it
 * MUST NOT mutate events (events are immutable). Communication between concerns
 * flows exclusively through events.
 */

import type { WorkoutEvent } from '../engine';

export interface Subscriber {
  /** Stable, unique identity. Used for registration + diagnostics. */
  readonly id: string;
  /** Higher runs earlier within a single event's delivery. Ties broken by registration order. */
  readonly priority: number;
  /** Cheap predicate deciding whether this subscriber cares about the event. */
  canHandle(event: WorkoutEvent): boolean;
  /** React to the event. May be async; delivery is synchronous and does not await. */
  handle(event: WorkoutEvent): void | Promise<void>;
}

/** Thrown when a subscriber id is registered twice. */
export class DuplicateSubscriberError extends Error {
  constructor(id: string) {
    super(`Subscriber "${id}" is already registered`);
    this.name = 'DuplicateSubscriberError';
  }
}
