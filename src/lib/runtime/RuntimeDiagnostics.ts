/**
 * RuntimeDiagnostics — observability for the event runtime.
 *
 * Tracks dispatch counts, the last event, subscriber failures, per-subscriber
 * execution time, queue depth, and the registered subscriber set. It exposes
 * only immutable snapshots and NEVER affects runtime behaviour (recording is
 * plain field/map updates that cannot throw meaningfully).
 */

import type {
  DiagnosticsSnapshot,
  RegisteredSubscriber,
  SubscriberExecutionStat,
  SubscriberFailure,
  WorkoutEvent,
} from './types';

const MAX_RECENT_FAILURES = 50;

export class RuntimeDiagnostics {
  private eventsDispatched = 0;
  private lastEventType: string | null = null;
  private lastEventSeq: number | null = null;
  private lastDispatchAt: number | null = null;

  private failureCount = 0;
  private recentFailures: SubscriberFailure[] = [];

  private readonly execution = new Map<string, { totalMs: number; count: number; lastMs: number }>();

  private queueDepth = 0;
  private peakQueueDepth = 0;

  private registered: RegisteredSubscriber[] = [];

  recordDispatchStart(event: WorkoutEvent, at: number): void {
    this.eventsDispatched += 1;
    this.lastEventType = event.type;
    this.lastEventSeq = event.seq;
    this.lastDispatchAt = at;
  }

  recordDelivery(subscriberId: string, durationMs: number): void {
    const prev = this.execution.get(subscriberId) ?? { totalMs: 0, count: 0, lastMs: 0 };
    this.execution.set(subscriberId, {
      totalMs: prev.totalMs + durationMs,
      count: prev.count + 1,
      lastMs: durationMs,
    });
  }

  recordFailure(failure: SubscriberFailure): void {
    this.failureCount += 1;
    this.recentFailures.push(failure);
    if (this.recentFailures.length > MAX_RECENT_FAILURES) {
      this.recentFailures.shift();
    }
  }

  recordQueueDepth(depth: number): void {
    this.queueDepth = depth;
    if (depth > this.peakQueueDepth) this.peakQueueDepth = depth;
  }

  setRegistered(list: readonly RegisteredSubscriber[]): void {
    this.registered = list.map((r) => ({ id: r.id, priority: r.priority }));
  }

  snapshot(): DiagnosticsSnapshot {
    const execution: SubscriberExecutionStat[] = [];
    for (const [subscriberId, s] of this.execution) {
      execution.push({ subscriberId, totalMs: s.totalMs, count: s.count, lastMs: s.lastMs });
    }
    return {
      eventsDispatched: this.eventsDispatched,
      lastEventType: this.lastEventType,
      lastEventSeq: this.lastEventSeq,
      lastDispatchAt: this.lastDispatchAt,
      failureCount: this.failureCount,
      recentFailures: this.recentFailures.slice(),
      execution,
      queueDepth: this.queueDepth,
      peakQueueDepth: this.peakQueueDepth,
      registered: this.registered.slice(),
    };
  }

  reset(): void {
    this.eventsDispatched = 0;
    this.lastEventType = null;
    this.lastEventSeq = null;
    this.lastDispatchAt = null;
    this.failureCount = 0;
    this.recentFailures = [];
    this.execution.clear();
    this.queueDepth = 0;
    this.peakQueueDepth = 0;
    // registered set is intentionally preserved (reflects the live bus).
  }
}
