import { describe, it, expect } from 'vitest';
import { Engine, FakeClock } from '../../lib/engine';
import { EngineController } from '../../lib/host';
import { ManualFrameScheduler, FakeVisibilitySource } from '../host-fakes';
import { makeConfig, seqIds } from '../fixtures';

interface Harness {
  controller: EngineController;
  engine: Engine;
  clock: FakeClock;
  scheduler: ManualFrameScheduler;
  visibility: FakeVisibilitySource;
}

function makeHarness(): Harness {
  const clock = new FakeClock(0);
  const scheduler = new ManualFrameScheduler();
  const visibility = new FakeVisibilitySource();
  const engine = new Engine(makeConfig(), { clock, idFactory: seqIds() });
  const controller = new EngineController({ engine, clock, scheduler, visibilitySource: visibility });
  return { controller, engine, clock, scheduler, visibility };
}

/** Advance the wall clock and run one frame. */
function frameAt(h: Harness, ms: number): void {
  h.clock.set(ms);
  h.scheduler.flushFrame();
}

describe('EngineController — command surface', () => {
  it('starts the workout and begins ticking', () => {
    const h = makeHarness();
    h.controller.start();
    expect(h.controller.getSnapshot().phase).toBe('warmup');
    expect(h.scheduler.pending).toBe(1); // loop is ticking
  });

  it('advances the engine as the loop ticks with the clock', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 4000); // warmup ends at 4000
    expect(h.controller.getSnapshot().phase).toBe('round');
    frameAt(h, 46000); // run to the end
    expect(h.controller.getSnapshot().phase).toBe('finished');
    expect(h.engine.session().status).toBe('completed');
  });

  it('stops ticking once the workout finishes', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 46000);
    expect(h.scheduler.pending).toBe(0); // loop torn down on finish
  });
});

describe('EngineController — snapshots', () => {
  it('coalesces per-frame ticks: identity is stable within a second', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 4000); // into round 0
    const a = h.controller.getSnapshot();

    frameAt(h, 4500); // same displayed second (remainingSeconds unchanged)
    const b = h.controller.getSnapshot();
    expect(b).toBe(a); // stable reference — no needless re-render

    frameAt(h, 5000); // displayed second changes
    const c = h.controller.getSnapshot();
    expect(c).not.toBe(a);
    expect(c.remainingSeconds).toBe(11);
  });

  it('exposes a live per-frame snapshot separately', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 4500);
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(4500);
  });

  it('notifies subscribers on meaningful change', () => {
    const h = makeHarness();
    let notifications = 0;
    h.controller.subscribe(() => notifications++);
    h.controller.start(); // forced publish
    const afterStart = notifications;
    frameAt(h, 5000); // second changes → notify
    expect(notifications).toBeGreaterThan(afterStart);
  });
});

describe('EngineController — pause / resume', () => {
  it('pause freezes progression; resume continues with paused time excluded', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 5000); // round 0, elapsed 5000
    expect(h.controller.getSnapshot().phase).toBe('round');

    h.controller.pause();
    expect(h.engine.session().status).toBe('paused');
    expect(h.scheduler.pending).toBe(0); // loop paused

    // Time passes and frames flush, but nothing advances.
    frameAt(h, 9000);
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(5000);

    h.controller.resume();
    expect(h.scheduler.pending).toBe(1);
    frameAt(h, 16000); // elapsed = 16000 - 4000 paused = 12000
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(12000);
    expect(h.controller.getSnapshot().phase).toBe('round');
  });
});

describe('EngineController — visibility reconciliation', () => {
  it('does not tick while hidden, then reconciles elapsed time on return', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 5000); // round 0, elapsed 5000
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(5000);

    // Hide: the loop stops ticking, but the workout keeps elapsing in wall time.
    h.visibility.setHidden(true);
    expect(h.scheduler.pending).toBe(0);

    // 41 seconds pass while hidden; flushing frames does nothing.
    h.clock.set(46000);
    h.scheduler.flushFrame();
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(5000); // engine NOT advanced while hidden

    // Return to visible: reconcile in a single AdvanceTime (fast-forward).
    h.visibility.setHidden(false);
    expect(h.controller.getSnapshot().phase).toBe('finished');
    expect(h.controller.getLastReconciliationGapMs()).toBe(41000);
    expect(h.scheduler.pending).toBe(0); // finished → not resumed
  });

  it('resumes ticking on return when the workout is still running', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 5000);

    h.visibility.setHidden(true);
    h.clock.set(8000); // only 3s pass
    h.visibility.setHidden(false);

    expect(h.controller.getSnapshot().phase).toBe('round');
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(8000); // reconciled forward
    expect(h.scheduler.pending).toBe(1); // ticking resumed
  });

  it('hiding does not pause the workout clock (wall time keeps elapsing)', () => {
    const h = makeHarness();
    h.controller.start();
    frameAt(h, 5000);
    h.visibility.setHidden(true);
    h.clock.set(10000);
    h.visibility.setHidden(false);
    // 5s of hidden wall-time was applied, not discarded.
    expect(h.controller.getLiveSnapshot().elapsedMs).toBe(10000);
  });
});

describe('EngineController — dispose', () => {
  it('tears down loop, observer, and listeners', () => {
    const h = makeHarness();
    let notifications = 0;
    h.controller.subscribe(() => notifications++);
    h.controller.start();
    h.controller.dispose();

    // After dispose, visibility changes and frames are inert.
    const before = notifications;
    h.visibility.setHidden(true);
    h.scheduler.flushFrame();
    expect(notifications).toBe(before);
    expect(h.scheduler.pending).toBe(0);
  });
});
