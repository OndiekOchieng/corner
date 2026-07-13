/**
 * EngineController — the primary interface React uses. It is the ONLY thing that
 * dispatches commands to the engine; components never touch the engine directly.
 *
 * Responsibilities:
 *   - creating sessions / starting workouts / dispatching commands
 *   - forwarding elapsed time (via the RuntimeLoop → AdvanceTime)
 *   - reconciling elapsed time on visibility changes
 *   - exposing immutable, coalesced snapshots (for useSyncExternalStore)
 *
 * It owns the browser-facing RuntimeLoop and VisibilityObserver but delegates
 * ALL workout logic to the engine. No workout state is derived here.
 */

import type { Clock, Engine, WorkoutSnapshot, WorkoutSession, WorkoutEvent } from '../engine';
import { RuntimeLoop, type FrameScheduler } from './RuntimeLoop';
import { VisibilityObserver, type VisibilitySource } from './VisibilityObserver';

export interface EngineControllerDeps {
  readonly engine: Engine;
  readonly clock: Clock;
  readonly scheduler: FrameScheduler;
  readonly visibilitySource: VisibilitySource;
  /**
   * Optional sink for the events produced by each engine dispatch. The Host
   * Runtime wires this to the EventBus (PR-004b). Only the events from the
   * current dispatch are forwarded — never the historical log.
   */
  readonly onEvents?: (events: readonly WorkoutEvent[]) => void;
}

/**
 * Two snapshots are "meaningfully equal" when the fields the UI renders
 * discretely are unchanged. This coalesces per-frame ticks to ~1 Hz so the
 * `getSnapshot()` reference stays stable (required by useSyncExternalStore) and
 * text re-renders only when the displayed second changes.
 */
function meaningfulEquals(a: WorkoutSnapshot, b: WorkoutSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.status === b.status &&
    a.roundIndex === b.roundIndex &&
    a.roundNumber === b.roundNumber &&
    a.totalRounds === b.totalRounds &&
    a.remainingSeconds === b.remainingSeconds
  );
}

const isTimedRunning = (s: WorkoutSnapshot): boolean =>
  s.status === 'running' && (s.phase === 'warmup' || s.phase === 'round' || s.phase === 'rest');

export class EngineController {
  private readonly engine: Engine;
  private readonly clock: Clock;
  private readonly loop: RuntimeLoop;
  private readonly visibility: VisibilityObserver;
  private readonly onEvents?: (events: readonly WorkoutEvent[]) => void;

  private readonly listeners = new Set<() => void>();
  private cachedSnapshot: WorkoutSnapshot;
  private hiddenAt: number | null = null;
  private lastReconciliationGapMs = 0;

  constructor(deps: EngineControllerDeps) {
    this.engine = deps.engine;
    this.clock = deps.clock;
    this.onEvents = deps.onEvents;
    this.loop = new RuntimeLoop(deps.scheduler, () => this.handleFrame());
    this.visibility = new VisibilityObserver(deps.visibilitySource, {
      onHidden: () => this.handleHidden(),
      onVisible: () => this.handleVisible(),
    });
    this.cachedSnapshot = this.engine.snapshot();
  }

  /** Forward only the newly produced events to the runtime (if wired). */
  private forward(events: readonly WorkoutEvent[]): void {
    if (events.length > 0) this.onEvents?.(events);
  }

  // --- Commands (the React-facing surface) -----------------------------------

  start(): void {
    this.forward(this.engine.start());
    this.visibility.start();
    this.loop.start();
    this.publish(true);
  }

  pause(): void {
    this.forward(this.engine.pause());
    this.loop.pause();
    this.publish(true);
  }

  resume(): void {
    this.forward(this.engine.resume());
    this.loop.resume();
    this.publish(true);
  }

  cancel(): void {
    this.forward(this.engine.cancel());
    this.loop.stop();
    this.publish(true);
  }

  dispose(): void {
    this.loop.stop();
    this.visibility.stop();
    this.listeners.clear();
  }

  // --- Snapshots (React consumes these only) ---------------------------------

  /** Stable, coalesced snapshot for useSyncExternalStore. */
  getSnapshot(): WorkoutSnapshot {
    return this.cachedSnapshot;
  }

  /** Live per-frame snapshot (e.g. for a smooth progress ring). */
  getLiveSnapshot(): WorkoutSnapshot {
    return this.engine.snapshot();
  }

  getSession(): WorkoutSession {
    return this.engine.session();
  }

  /** The engine event log (an event bus is PR-004b, not here). */
  getEvents(): readonly WorkoutEvent[] {
    return this.engine.events();
  }

  /** Wall-time gap (ms) reconciled on the last return-to-visible. */
  getLastReconciliationGapMs(): number {
    return this.lastReconciliationGapMs;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Internals -------------------------------------------------------------

  private handleFrame(): void {
    this.forward(this.engine.advance()); // forward elapsed time; the engine owns all logic
    this.publish();
    if (this.engine.snapshot().phase === 'finished') {
      this.loop.stop();
    }
  }

  private handleHidden(): void {
    // Do NOT pause the workout — wall time keeps elapsing. Just stop ticking;
    // frames would be throttled while hidden anyway.
    this.hiddenAt = this.clock.now();
    this.loop.pause();
  }

  private handleVisible(): void {
    this.lastReconciliationGapMs = this.hiddenAt !== null ? Math.max(0, this.clock.now() - this.hiddenAt) : 0;
    this.hiddenAt = null;

    // Reconcile: a single AdvanceTime jumps elapsed forward; the engine's
    // fast-forward handles any boundaries crossed while hidden.
    this.forward(this.engine.advance());
    this.publish();

    // Resume ticking only if the workout is still actively running.
    if (isTimedRunning(this.engine.snapshot())) {
      this.loop.resume();
    }
  }

  private publish(force = false): void {
    const next = this.engine.snapshot();
    if (force || !meaningfulEquals(next, this.cachedSnapshot)) {
      this.cachedSnapshot = next;
      this.notify();
    }
  }

  private notify(): void {
    // Isolate listener failures so one bad subscriber can't break the runtime.
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* swallow — a UI subscriber must not break the loop */
      }
    });
  }
}
