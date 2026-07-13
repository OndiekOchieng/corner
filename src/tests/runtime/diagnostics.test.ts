import { describe, it, expect } from 'vitest';
import { EventBus } from '../../lib/runtime';
import { OrderSub, CountingSub, roundStartedEvent, steppingNow } from './helpers';

describe('RuntimeDiagnostics', () => {
  it('tracks dispatch count, last event, and registered subscribers', () => {
    const bus = new EventBus({ now: steppingNow() });
    bus.register(new OrderSub('a', 2, []));
    bus.register(new OrderSub('b', 1, []));

    bus.publish(roundStartedEvent(0));
    bus.publish(roundStartedEvent(1));

    const d = bus.getDiagnostics();
    expect(d.eventsDispatched).toBe(2);
    expect(d.lastEventType).toBe('ROUND_STARTED');
    expect(d.lastEventSeq).toBe(1);
    expect(d.registered.map((r) => r.id)).toEqual(['a', 'b']); // ordered by priority
  });

  it('records per-subscriber execution stats', () => {
    const bus = new EventBus({ now: steppingNow(1) }); // each now() call +1 → 1ms per delivery
    bus.register(new CountingSub('a', 0));
    bus.publish(roundStartedEvent(0));
    bus.publish(roundStartedEvent(1));

    const stat = bus.getDiagnostics().execution.find((e) => e.subscriberId === 'a');
    expect(stat?.count).toBe(2);
    expect(stat?.totalMs).toBeGreaterThan(0);
  });

  it('records subscriber failures without affecting delivery', () => {
    const bus = new EventBus({ now: steppingNow() });
    const log: string[] = [];
    bus.register(new OrderSub('bad', 2, log, { throwOn: true }));
    bus.register(new OrderSub('good', 1, log));
    bus.publish(roundStartedEvent(3));

    const d = bus.getDiagnostics();
    expect(d.failureCount).toBe(1);
    expect(log).toEqual(['good']);
  });

  it('reports queue depth for batches and returns to zero', () => {
    const bus = new EventBus({ now: steppingNow() });
    bus.register(new CountingSub('a', 0));
    bus.publishAll([roundStartedEvent(0), roundStartedEvent(1), roundStartedEvent(2)]);
    const d = bus.getDiagnostics();
    expect(d.peakQueueDepth).toBe(3);
    expect(d.queueDepth).toBe(0);
  });

  it('returns immutable snapshots (copies, not live references)', () => {
    const bus = new EventBus({ now: steppingNow() });
    bus.register(new CountingSub('a', 0));
    bus.publish(roundStartedEvent(0));
    const snap = bus.getDiagnostics();
    const registeredLen = snap.registered.length;
    (snap.registered as unknown as unknown[]).push({ id: 'x', priority: 0 });
    // Mutating the snapshot must not affect the next snapshot.
    expect(bus.getDiagnostics().registered.length).toBe(registeredLen);
  });
});
