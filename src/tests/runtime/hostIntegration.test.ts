import { describe, it, expect } from 'vitest';
import { FakeClock } from '../../lib/engine';
import { createHostRuntime } from '../../lib/host';
import { EventBus, StatsSubscriber } from '../../lib/runtime';
import { ManualFrameScheduler, FakeVisibilitySource } from '../host-fakes';
import { makeConfig, seqIds } from '../fixtures';
import { CountingSub } from './helpers';

function makeRuntime(bus: EventBus, subs: CountingSub[]) {
  const clock = new FakeClock(0);
  const scheduler = new ManualFrameScheduler();
  const visibility = new FakeVisibilitySource();
  for (const s of subs) bus.register(s);
  const runtime = createHostRuntime(makeConfig(), {
    clock,
    scheduler,
    visibilitySource: visibility,
    idFactory: seqIds(),
    eventBus: bus,
  });
  return { runtime, clock, scheduler, visibility };
}

describe('Host Runtime composes the Event Runtime', () => {
  it('publishes only the newly generated events after each dispatch (no replay)', () => {
    const bus = new EventBus();
    const sub = new CountingSub('spy', 0);
    const { runtime, clock, scheduler } = makeRuntime(bus, [sub]);

    runtime.controller.start();
    // start → WORKOUT_STARTED, WARMUP_STARTED
    expect(sub.received.map((e) => e.type)).toEqual(['WORKOUT_STARTED', 'WARMUP_STARTED']);

    const afterStart = sub.received.length;
    clock.set(4000);
    scheduler.flushFrame(); // warmup boundary → WARMUP_COMPLETED, ROUND_STARTED
    const newlyDelivered = sub.received.slice(afterStart).map((e) => e.type);
    expect(newlyDelivered).toEqual(['WARMUP_COMPLETED', 'ROUND_STARTED']); // only the new ones

    runtime.dispose();
  });

  it('delivered events exactly match the engine log, in order, with no duplicates', () => {
    const bus = new EventBus();
    const sub = new CountingSub('spy', 0);
    const { runtime, clock, scheduler } = makeRuntime(bus, [sub]);

    runtime.controller.start();
    for (let t = 250; t <= 46000; t += 250) {
      clock.set(t);
      scheduler.flushFrame();
    }

    const deliveredSeqs = sub.received.map((e) => e.seq);
    const engineSeqs = runtime.engine.events().map((e) => e.seq);
    expect(deliveredSeqs).toEqual(engineSeqs); // same events, same order, once each
    expect(new Set(deliveredSeqs).size).toBe(deliveredSeqs.length); // no duplicates

    runtime.dispose();
  });

  it('drives real subscribers (stats) to a completed session via the loop', () => {
    const bus = new EventBus();
    const stats = new StatsSubscriber();
    bus.register(stats);
    const clock = new FakeClock(0);
    const scheduler = new ManualFrameScheduler();
    const visibility = new FakeVisibilitySource();
    const runtime = createHostRuntime(makeConfig(), {
      clock,
      scheduler,
      visibilitySource: visibility,
      idFactory: seqIds(),
      eventBus: bus,
    });

    runtime.controller.start();
    for (let t = 250; t <= 46000; t += 250) {
      clock.set(t);
      scheduler.flushFrame();
    }

    expect(stats.getStats().completed).toBe(true);
    expect(stats.getStats().roundsCompleted).toBe(3);
    expect(bus.getDiagnostics().eventsDispatched).toBe(runtime.engine.events().length);

    runtime.dispose();
  });

  it('reconciled visibility events are published too (fast-forward)', () => {
    const bus = new EventBus();
    const sub = new CountingSub('spy', 0);
    const { runtime, clock, scheduler, visibility } = makeRuntime(bus, [sub]);

    runtime.controller.start();
    clock.set(5000);
    scheduler.flushFrame();

    visibility.setHidden(true);
    clock.set(46000);
    visibility.setHidden(false); // reconcile → many boundaries at once

    const types = sub.received.map((e) => e.type);
    expect(types).toContain('WORKOUT_COMPLETED');
    expect(types.filter((t) => t === 'WORKOUT_STARTED')).toHaveLength(1); // no replay

    runtime.dispose();
  });
});
