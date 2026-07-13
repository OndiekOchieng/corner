/**
 * Shared runtime types: delivery reports and diagnostics snapshots.
 */

import type { WorkoutEvent } from '../engine';

export type { WorkoutEvent };

/** Injectable monotonic time source (ms). Defaults to performance.now/Date.now. */
export type { NowFn } from '../platform/time';

/** Outcome of delivering one event to one subscriber. */
export interface Delivery {
  readonly subscriberId: string;
  /** Whether `canHandle` returned true (the handler ran). */
  readonly handled: boolean;
  /** Whether the handler completed without throwing (sync). */
  readonly ok: boolean;
  readonly durationMs: number;
  readonly error?: unknown;
}

/** Outcome of delivering one event to all subscribers, in priority order. */
export interface DispatchReport {
  readonly event: WorkoutEvent;
  readonly deliveries: readonly Delivery[];
  readonly failures: number;
}

export interface SubscriberFailure {
  readonly subscriberId: string;
  readonly eventType: string;
  readonly eventSeq: number;
  readonly error: unknown;
  readonly at: number;
}

export interface SubscriberExecutionStat {
  readonly subscriberId: string;
  readonly totalMs: number;
  readonly count: number;
  readonly lastMs: number;
}

export interface RegisteredSubscriber {
  readonly id: string;
  readonly priority: number;
}

/** Immutable diagnostics snapshot. Reading it never affects runtime behaviour. */
export interface DiagnosticsSnapshot {
  readonly eventsDispatched: number;
  readonly lastEventType: string | null;
  readonly lastEventSeq: number | null;
  readonly lastDispatchAt: number | null;
  readonly failureCount: number;
  readonly recentFailures: readonly SubscriberFailure[];
  readonly execution: readonly SubscriberExecutionStat[];
  readonly queueDepth: number;
  readonly peakQueueDepth: number;
  readonly registered: readonly RegisteredSubscriber[];
}
