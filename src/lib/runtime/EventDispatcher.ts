/**
 * EventDispatcher — delivers ONE event to an ordered subscriber list with full
 * isolation and timing.
 *
 * Each subscriber runs inside try/catch: a thrown handler is recorded as a
 * failure and delivery continues to the remaining subscribers. Async handlers
 * are invoked but not awaited (delivery is synchronous by default); a rejected
 * promise is reported to diagnostics without blocking.
 */

import type { Subscriber } from './Subscriber';
import type { RuntimeDiagnostics } from './RuntimeDiagnostics';
import type { Delivery, DispatchReport, NowFn, WorkoutEvent } from './types';

export class EventDispatcher {
  private readonly diagnostics: RuntimeDiagnostics;
  private readonly now: NowFn;

  constructor(diagnostics: RuntimeDiagnostics, now: NowFn) {
    this.diagnostics = diagnostics;
    this.now = now;
  }

  dispatch(event: WorkoutEvent, subscribers: readonly Subscriber[]): DispatchReport {
    const deliveries: Delivery[] = [];
    let failures = 0;

    for (const subscriber of subscribers) {
      const start = this.now();
      let handled = false;
      let ok = true;
      let error: unknown;

      try {
        if (subscriber.canHandle(event)) {
          handled = true;
          const result = subscriber.handle(event);
          if (result instanceof Promise) {
            result.catch((err) => this.reportFailure(subscriber.id, event, err));
          }
        }
      } catch (err) {
        ok = false;
        error = err;
        failures += 1;
        this.reportFailure(subscriber.id, event, err);
      }

      const durationMs = this.now() - start;
      this.diagnostics.recordDelivery(subscriber.id, durationMs);
      deliveries.push({ subscriberId: subscriber.id, handled, ok, durationMs, error });
    }

    return { event, deliveries, failures };
  }

  private reportFailure(subscriberId: string, event: WorkoutEvent, error: unknown): void {
    this.diagnostics.recordFailure({
      subscriberId,
      eventType: event.type,
      eventSeq: event.seq,
      error,
      at: this.now(),
    });
  }
}
