/**
 * RuntimeLoop — decides *when* to advance the engine; it contains NO workout
 * logic. Each scheduled frame invokes an injected `onFrame` callback (which the
 * EngineController wires to a single `AdvanceTime` dispatch). Elapsed time comes
 * from the Clock, never from the frame callback's timestamp.
 *
 * The frame source is abstracted behind `FrameScheduler` so the loop is testable
 * deterministically in Node (a manual scheduler) and uses `requestAnimationFrame`
 * in the browser.
 */

export interface FrameScheduler {
  /** Schedule a single callback for the next frame; returns a cancel handle. */
  schedule(callback: () => void): number;
  cancel(handle: number): void;
}

/** Browser scheduler backed by requestAnimationFrame. */
export class RafScheduler implements FrameScheduler {
  schedule(callback: () => void): number {
    if (typeof requestAnimationFrame === 'undefined') {
      throw new Error('RafScheduler requires a browser environment (requestAnimationFrame)');
    }
    return requestAnimationFrame(callback);
  }

  cancel(handle: number): void {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(handle);
    }
  }
}

/**
 * A self-rescheduling loop. Lifecycle:
 *   start()  → begin ticking
 *   pause()  → stop ticking, stay active (resumable)
 *   resume() → resume ticking
 *   stop()   → tear down
 *
 * "Ticking" schedules exactly one frame at a time; each frame runs `onFrame`
 * then schedules the next. Pausing/stopping cancels the pending frame.
 */
export class RuntimeLoop {
  private readonly scheduler: FrameScheduler;
  private readonly onFrame: () => void;
  private handle: number | null = null;
  private active = false;
  private ticking = false;

  constructor(scheduler: FrameScheduler, onFrame: () => void) {
    this.scheduler = scheduler;
    this.onFrame = onFrame;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.begin();
  }

  stop(): void {
    this.active = false;
    this.halt();
  }

  pause(): void {
    if (!this.active) return;
    this.halt();
  }

  resume(): void {
    if (!this.active || this.ticking) return;
    this.begin();
  }

  get isActive(): boolean {
    return this.active;
  }

  get isTicking(): boolean {
    return this.ticking;
  }

  private begin(): void {
    this.ticking = true;
    this.scheduleNext();
  }

  private halt(): void {
    this.ticking = false;
    if (this.handle !== null) {
      this.scheduler.cancel(this.handle);
      this.handle = null;
    }
  }

  private scheduleNext(): void {
    this.handle = this.scheduler.schedule(this.frame);
  }

  private readonly frame = (): void => {
    if (!this.ticking) return;
    this.handle = null;
    this.onFrame();
    if (this.ticking) this.scheduleNext();
  };
}
