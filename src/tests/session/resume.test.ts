import { describe, it, expect } from 'vitest';
import { FakeClock } from '../../lib/engine';
import { EventBus } from '../../lib/runtime';
import { EngineController } from '../../lib/host';
import { SessionRestorer } from '../../lib/session';
import { ManualFrameScheduler, FakeVisibilitySource } from '../host-fakes';
import { CountingSub } from '../runtime/helpers';
import { makeConfig, seqIds } from '../fixtures';
import { sessionAt, recordFrom } from './helpers';

describe('SessionRestorer — priming', () => {
  it('reconstructs a running engine exactly at the saved cursor', () => {
    const record = recordFrom(sessionAt(25000)); // mid round 1 (19000–31000)
    const realClock = new FakeClock(1000);
    const { engine, cursorMs } = new SessionRestorer().restore(record, makeConfig(), realClock);

    expect(cursorMs).toBe(25000);
    expect(engine.snapshot().elapsedMs).toBe(25000);
    expect(engine.snapshot().phase).toBe('round');
    expect(engine.snapshot().roundNumber).toBe(2);
    expect(engine.session().id).toBe(record.session.id); // same id → idempotent restore
  });

  it('restores a paused session as paused', () => {
    const running = sessionAt(25000);
    const pausedRecord = recordFrom({ ...running, status: 'paused' });
    const { engine } = new SessionRestorer().restore(pausedRecord, makeConfig(), new FakeClock(0));
    expect(engine.snapshot().status).toBe('paused');
  });
});

describe('Resume — live continuation without replay', () => {
  it('continues from the cursor with no duplicated events', () => {
    const record = recordFrom(sessionAt(25000));
    const realClock = new FakeClock(1000);
    const { engine, clock } = new SessionRestorer().restore(record, makeConfig(), realClock);

    // Wrap the primed engine in a live controller + bus.
    const bus = new EventBus();
    const sub = new CountingSub('spy', 0);
    bus.register(sub);
    const scheduler = new ManualFrameScheduler();
    const controller = new EngineController({
      engine,
      clock,
      scheduler,
      visibilitySource: new FakeVisibilitySource(),
      onEvents: (events) => bus.publishAll(events),
    });

    controller.start(); // engine already running → no re-start, no WORKOUT_STARTED
    // Drive real time forward so elapsed goes 25000 → 46000.
    realClock.set(22000); // resumeClock = 22000 + 25000 = 47000 → clamps to 46000
    scheduler.flushFrame();

    const types = sub.received.map((e) => e.type);
    expect(types).not.toContain('WORKOUT_STARTED'); // no replay of the intro
    expect(types).not.toContain('WARMUP_STARTED');
    expect(types).toContain('WORKOUT_COMPLETED');
    expect(types.filter((t) => t === 'WORKOUT_COMPLETED')).toHaveLength(1);
    expect(controller.getSnapshot().phase).toBe('finished');
  });

  it('duplicate restoration is idempotent (same cursor, same id)', () => {
    const record = recordFrom(sessionAt(25000));
    const restorer = new SessionRestorer();
    const a = restorer.restore(record, makeConfig(), new FakeClock(0));
    const b = restorer.restore(record, makeConfig(), new FakeClock(0));
    expect(a.engine.snapshot().elapsedMs).toBe(b.engine.snapshot().elapsedMs);
    expect(a.engine.session().id).toBe(b.engine.session().id);
  });
});
