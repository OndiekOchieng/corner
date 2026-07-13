/**
 * EventBus — the single event-delivery mechanism for the runtime.
 *
 * Composes SubscriberRegistry + EventDispatcher + RuntimeDiagnostics. The engine
 * never touches it; the Host Runtime publishes only the events produced by the
 * current engine dispatch (never the historical log).
 *
 *   Engine → Host Runtime → EventBus → Subscribers (priority order) → done
 */

import { EventDispatcher } from './EventDispatcher';
import { RuntimeDiagnostics } from './RuntimeDiagnostics';
import { SubscriberRegistry } from './SubscriberRegistry';
import type { Subscriber } from './Subscriber';
import type { DiagnosticsSnapshot, DispatchReport, NowFn, WorkoutEvent } from './types';
import { systemNow } from '../platform/time';

export interface EventBusOptions {
  readonly now?: NowFn;
  readonly diagnostics?: RuntimeDiagnostics;
}

export class EventBus {
  private readonly registry = new SubscriberRegistry();
  private readonly diagnostics: RuntimeDiagnostics;
  private readonly dispatcher: EventDispatcher;
  private readonly now: NowFn;

  constructor(options: EventBusOptions = {}) {
    this.now = options.now ?? systemNow;
    this.diagnostics = options.diagnostics ?? new RuntimeDiagnostics();
    this.dispatcher = new EventDispatcher(this.diagnostics, this.now);
  }

  register(subscriber: Subscriber): void {
    this.registry.register(subscriber);
    this.diagnostics.setRegistered(this.registry.list());
  }

  unregister(id: string): boolean {
    const removed = this.registry.unregister(id);
    if (removed) this.diagnostics.setRegistered(this.registry.list());
    return removed;
  }

  clear(): void {
    this.registry.clear();
    this.diagnostics.setRegistered([]);
  }

  subscriberCount(): number {
    return this.registry.count();
  }

  hasSubscriber(id: string): boolean {
    return this.registry.has(id);
  }

  /** Deliver a single event to all subscribers in priority order. */
  publish(event: WorkoutEvent): DispatchReport {
    this.diagnostics.recordDispatchStart(event, this.now());
    return this.dispatcher.dispatch(event, this.registry.ordered());
  }

  /** Deliver a batch (the events from one engine dispatch), preserving order. */
  publishAll(events: readonly WorkoutEvent[]): DispatchReport[] {
    const reports: DispatchReport[] = [];
    for (let i = 0; i < events.length; i++) {
      this.diagnostics.recordQueueDepth(events.length - i);
      reports.push(this.publish(events[i]));
    }
    this.diagnostics.recordQueueDepth(0);
    return reports;
  }

  getDiagnostics(): DiagnosticsSnapshot {
    return this.diagnostics.snapshot();
  }
}
