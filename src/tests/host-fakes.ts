/**
 * Deterministic test doubles for the host adapter. No real browser, no jsdom,
 * no real timers — the whole runtime is driven by hand.
 */

import type { FrameScheduler } from '../lib/host';
import type { VisibilitySource } from '../lib/host';

/** A FrameScheduler the test steps manually via `flushFrame()`. */
export class ManualFrameScheduler implements FrameScheduler {
  private callbacks = new Map<number, () => void>();
  private nextHandle = 0;

  schedule(callback: () => void): number {
    const handle = ++this.nextHandle;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  /** Run every currently-scheduled callback once (reschedules land in the next frame). */
  flushFrame(): void {
    const current = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const cb of current) cb();
  }

  get pending(): number {
    return this.callbacks.size;
  }
}

/** A VisibilitySource driven by `setHidden()`. */
export class FakeVisibilitySource implements VisibilitySource {
  private hidden = false;
  private subscribers = new Set<() => void>();

  isHidden(): boolean {
    return this.hidden;
  }

  subscribe(onChange: () => void): () => void {
    this.subscribers.add(onChange);
    return () => this.subscribers.delete(onChange);
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.subscribers.forEach((cb) => cb());
  }
}
