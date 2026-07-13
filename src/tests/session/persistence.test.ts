import { describe, it, expect } from 'vitest';
import { Engine, FakeClock, type WorkoutEvent } from '../../lib/engine';
import { EventBus } from '../../lib/runtime';
import { EngineController } from '../../lib/host';
import {
  InMemoryStorageAdapter,
  SessionRepository,
  SessionSerializer,
  SessionHydrator,
  SessionDiagnostics,
  PersistenceSubscriber,
} from '../../lib/session';
import { ManualFrameScheduler, FakeVisibilitySource } from '../host-fakes';
import { makeConfig, seqIds } from '../fixtures';
import { sessionAt, controllableNow } from './helpers';

function makeRepo(storage = new InMemoryStorageAdapter(), diagnostics?: SessionDiagnostics) {
  const serializer = new SessionSerializer();
  return { storage, repo: new SessionRepository(storage, serializer, new SessionHydrator(serializer), { diagnostics }) };
}

const startedEvent: WorkoutEvent = {
  type: 'WORKOUT_STARTED',
  at: 0,
  elapsedMs: 0,
  seq: 0,
  data: { workoutId: 'w1', totalRounds: 3, plannedDurationMs: 46000, hasWarmup: true },
};

describe('PersistenceSubscriber — debounce', () => {
  it('writes at most once per second on the progress path', async () => {
    const { storage, repo } = makeRepo();
    const clock = controllableNow();
    const session = sessionAt(5000);
    const sub = new PersistenceSubscriber(repo, () => session, { now: clock.now, minIntervalMs: 1000 });

    await sub.checkpoint();
    await sub.checkpoint();
    await sub.checkpoint();
    expect(storage.saveCount).toBe(1); // debounced within the same second

    clock.set(1000);
    await sub.checkpoint();
    expect(storage.saveCount).toBe(2); // a second later → one more write
  });

  it('forces a write for state-critical lifecycle events, bypassing debounce', async () => {
    const { storage, repo } = makeRepo();
    const clock = controllableNow();
    const sub = new PersistenceSubscriber(repo, () => sessionAt(5000), { now: clock.now, minIntervalMs: 1000 });

    await sub.checkpoint(); // write 1 @0
    await sub.handle(startedEvent); // forced write @0 (same second)
    expect(storage.saveCount).toBe(2);
  });
});

describe('PersistenceSubscriber — lifecycle finalize (via the live runtime)', () => {
  function buildRuntime(storage: InMemoryStorageAdapter, diagnostics: SessionDiagnostics) {
    const clock = new FakeClock(0);
    const scheduler = new ManualFrameScheduler();
    const engine = new Engine(makeConfig(), { clock, idFactory: seqIds() });
    const bus = new EventBus();
    const controller = new EngineController({
      engine,
      clock,
      scheduler,
      visibilitySource: new FakeVisibilitySource(),
      onEvents: (events) => bus.publishAll(events),
    });
    const { repo } = makeRepo(storage, diagnostics);
    bus.register(
      new PersistenceSubscriber(repo, () => controller.getSession(), { now: () => clock.now(), diagnostics })
    );
    return { clock, scheduler, controller, repo };
  }

  it('moves a completed session to history and clears the active slot', async () => {
    const storage = new InMemoryStorageAdapter();
    const diag = new SessionDiagnostics(() => 0);
    const { clock, scheduler, controller, repo } = buildRuntime(storage, diag);

    controller.start();
    for (let t = 250; t <= 46000; t += 250) {
      clock.set(t);
      scheduler.flushFrame();
    }
    // Allow queued async writes (finalize) to settle.
    await Promise.resolve();
    await Promise.resolve();

    const history = await repo.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
    expect(history[0].completedRounds).toBe(3);
    expect((await repo.loadActive()).ok).toBe(false); // active cleared on finish
  });

  it('moves a cancelled session to history and clears the active slot', async () => {
    const storage = new InMemoryStorageAdapter();
    const diag = new SessionDiagnostics(() => 0);
    const { clock, scheduler, controller, repo } = buildRuntime(storage, diag);

    controller.start();
    clock.set(10000);
    scheduler.flushFrame();
    controller.cancel();
    await Promise.resolve();
    await Promise.resolve();

    const history = await repo.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('cancelled');
    expect((await repo.loadActive()).ok).toBe(false);
  });
});
