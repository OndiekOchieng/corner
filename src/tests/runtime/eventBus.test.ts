import { describe, it, expect } from 'vitest';
import { EventBus, DuplicateSubscriberError } from '../../lib/runtime';
import { OrderSub, CountingSub, roundStartedEvent } from './helpers';

describe('EventBus — registration', () => {
  it('registers, counts, and reports membership', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('a', 0, log));
    expect(bus.subscriberCount()).toBe(1);
    expect(bus.hasSubscriber('a')).toBe(true);
    expect(bus.hasSubscriber('b')).toBe(false);
  });

  it('prevents duplicate registration', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('a', 0, log));
    expect(() => bus.register(new OrderSub('a', 0, log))).toThrow(DuplicateSubscriberError);
    expect(bus.subscriberCount()).toBe(1);
  });

  it('unregisters and clears', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('a', 0, log));
    bus.register(new OrderSub('b', 0, log));
    expect(bus.unregister('a')).toBe(true);
    expect(bus.unregister('missing')).toBe(false);
    expect(bus.subscriberCount()).toBe(1);
    bus.clear();
    expect(bus.subscriberCount()).toBe(0);
  });
});

describe('EventBus — deterministic priority ordering', () => {
  it('delivers in descending priority order', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('low', 1, log));
    bus.register(new OrderSub('high', 3, log));
    bus.register(new OrderSub('mid', 2, log));
    bus.publish(roundStartedEvent(0));
    expect(log).toEqual(['high', 'mid', 'low']);
  });

  it('breaks ties by registration order (stable)', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('first', 5, log));
    bus.register(new OrderSub('second', 5, log));
    bus.register(new OrderSub('third', 5, log));
    bus.publish(roundStartedEvent(0));
    expect(log).toEqual(['first', 'second', 'third']);
  });

  it('produces the same order on every dispatch', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('a', 2, log));
    bus.register(new OrderSub('b', 1, log));
    bus.publish(roundStartedEvent(0));
    bus.publish(roundStartedEvent(1));
    expect(log).toEqual(['a', 'b', 'a', 'b']);
  });
});

describe('EventBus — isolation', () => {
  it('one failing subscriber does not stop the others', () => {
    const bus = new EventBus();
    const log: string[] = [];
    bus.register(new OrderSub('ok-1', 3, log));
    bus.register(new OrderSub('bad', 2, log, { throwOn: true }));
    bus.register(new OrderSub('ok-2', 1, log));

    const report = bus.publish(roundStartedEvent(7));

    expect(log).toEqual(['ok-1', 'ok-2']); // bad threw but delivery continued
    expect(report.failures).toBe(1);
    const diag = bus.getDiagnostics();
    expect(diag.failureCount).toBe(1);
    expect(diag.recentFailures[0]).toMatchObject({ subscriberId: 'bad', eventSeq: 7 });
  });
});

describe('EventBus — filtering & batches', () => {
  it('respects canHandle', () => {
    const bus = new EventBus();
    const roundsOnly = new CountingSub('rounds', 0, (e) => e.type === 'ROUND_STARTED');
    const nothing = new CountingSub('none', 0, () => false);
    bus.register(roundsOnly);
    bus.register(nothing);
    bus.publish(roundStartedEvent(0));
    expect(roundsOnly.received).toHaveLength(1);
    expect(nothing.received).toHaveLength(0);
  });

  it('publishAll delivers a batch in order', () => {
    const bus = new EventBus();
    const sub = new CountingSub('all', 0);
    bus.register(sub);
    const reports = bus.publishAll([roundStartedEvent(0), roundStartedEvent(1), roundStartedEvent(2)]);
    expect(reports).toHaveLength(3);
    expect(sub.received.map((e) => e.seq)).toEqual([0, 1, 2]);
  });
});
