/**
 * History wiring — the live pipeline a completed workout travels:
 *   Engine → Event Runtime → PersistenceSubscriber → SessionRepository → storage
 *   → HistoryService (what the History screen reads).
 *
 * Headless and deterministic (FakeClock, in-memory storage), but the exact wiring
 * used by useCoachedWorkout: one PersistenceSubscriber with a coach + wall-clock now.
 */

import { describe, it, expect } from 'vitest';
import { Engine, FakeClock } from '../../lib/engine';
import { EventBus } from '../../lib/runtime';
import { EngineController } from '../../lib/host';
import {
  InMemoryStorageAdapter,
  SessionRepository,
  HistoryService,
  PersistenceSubscriber,
} from '../../lib/session';
import { ManualFrameScheduler, FakeVisibilitySource } from '../host-fakes';
import { makeConfig, seqIds } from '../fixtures';

function buildRuntime(coach: string, wallNow: () => number) {
  const storage = new InMemoryStorageAdapter();
  const repo = new SessionRepository(storage);
  const history = new HistoryService(repo);
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
  bus.register(
    new PersistenceSubscriber(repo, () => controller.getSession(), {
      now: wallNow,
      meta: () => ({ rating: null, notes: null, coach }),
    }),
  );
  return { clock, scheduler, controller, repo, history };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('History wiring — a completed workout appears in History', () => {
  it('stores the workout, coach, duration, rounds, and completed time', async () => {
    const WALL = 1_700_000_000_000;
    const { clock, scheduler, controller, history } = buildRuntime('fightnight', () => WALL);

    controller.start();
    for (let t = 250; t <= 46000; t += 250) {
      clock.set(t);
      scheduler.flushFrame();
    }
    await settle();

    const sessions = await history.listSessions();
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.status).toBe('completed');
    expect(s.workoutId).toBe('w1');
    expect(s.coach).toBe('fightnight'); // shown in History
    expect(s.completedRounds).toBe(3);
    expect(s.durationMs).toBeGreaterThan(0);
    expect(s.savedAt).toBe(WALL); // wall-clock completed time
  });

  it('attaches a rating from the finish screen without losing the coach', async () => {
    const { clock, scheduler, controller, repo, history } = buildRuntime('calm', () => 1_700_000_000_000);
    controller.start();
    for (let t = 250; t <= 46000; t += 250) {
      clock.set(t);
      scheduler.flushFrame();
    }
    await settle();

    const [before] = await history.listSessions();
    expect(before.rating).toBeNull();

    await repo.updateHistory(before.id, { rating: 5, notes: 'strong' });

    const [after] = await history.listSessions();
    expect(after.rating).toBe(5);
    expect(after.notes).toBe('strong');
    expect(after.coach).toBe('calm'); // preserved through the rating patch
  });

  it('accumulates multiple completed workouts', async () => {
    // Two independent sessions writing to the SAME storage — distinct ids via a
    // shared counter (a fresh seqIds() would collide and overwrite).
    const storage = new InMemoryStorageAdapter();
    const history = new HistoryService(new SessionRepository(storage));
    let n = 0;
    const idFactory = () => `s${++n}`;
    for (const coach of ['technical', 'oldschool']) {
      const repo = new SessionRepository(storage);
      const clock = new FakeClock(0);
      const scheduler = new ManualFrameScheduler();
      const engine = new Engine(makeConfig(), { clock, idFactory });
      const bus = new EventBus();
      const controller = new EngineController({
        engine, clock, scheduler,
        visibilitySource: new FakeVisibilitySource(),
        onEvents: (e) => bus.publishAll(e),
      });
      bus.register(
        new PersistenceSubscriber(repo, () => controller.getSession(), {
          now: () => 1_700_000_000_000,
          meta: () => ({ rating: null, notes: null, coach }),
        }),
      );
      controller.start();
      for (let t = 250; t <= 46000; t += 250) { clock.set(t); scheduler.flushFrame(); }
      await settle();
    }
    const sessions = await history.listSessions();
    expect(sessions).toHaveLength(2);
  });
});
