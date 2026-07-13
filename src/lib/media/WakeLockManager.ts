/**
 * WakeLockManager — keeps the screen awake during a workout.
 *
 * Acquires a screen wake lock when the workout begins, releases it when it ends,
 * and re-acquires it when the page becomes visible again (the browser drops the
 * lock whenever the tab is hidden). Degrades to a silent no-op where the Wake
 * Lock API is unavailable. The API is injected so it is fully testable.
 */

export interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockApiLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export type WakeLockStatus = 'unsupported' | 'released' | 'active';

export interface WakeLockManagerOptions {
  /** `null`/absent ⇒ Wake Lock unsupported. */
  readonly api?: WakeLockApiLike | null;
  readonly onStatusChange?: (status: WakeLockStatus) => void;
}

export class WakeLockManager {
  private readonly api: WakeLockApiLike | null;
  private readonly onStatusChange?: (status: WakeLockStatus) => void;
  private sentinel: WakeLockSentinelLike | null = null;
  /** The intended state — kept across browser-initiated releases so we can reacquire. */
  private wantActive = false;
  private status: WakeLockStatus;

  constructor(options: WakeLockManagerOptions = {}) {
    this.api = options.api ?? null;
    this.onStatusChange = options.onStatusChange;
    this.status = this.api ? 'released' : 'unsupported';
  }

  isSupported(): boolean {
    return this.api != null;
  }

  getStatus(): WakeLockStatus {
    return this.status;
  }

  async acquire(): Promise<boolean> {
    this.wantActive = true;
    if (!this.api) return false;
    if (this.sentinel) return true; // already held

    try {
      const sentinel = await this.api.request('screen');
      this.sentinel = sentinel;
      // The browser releases the lock when the tab hides; note that so a later
      // visibility change can reacquire.
      sentinel.addEventListener('release', () => {
        this.sentinel = null;
        if (this.status === 'active') this.setStatus('released');
      });
      this.setStatus('active');
      return true;
    } catch {
      this.setStatus('released');
      return false; // e.g. denied without a gesture — a later visible/gesture retries
    }
  }

  async release(): Promise<void> {
    this.wantActive = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        /* best-effort */
      }
    }
    if (this.api) this.setStatus('released');
  }

  /** Reacquire after returning to visibility, if a lock is still wanted. */
  async reacquireIfWanted(): Promise<void> {
    if (this.wantActive && !this.sentinel) await this.acquire();
  }

  private setStatus(status: WakeLockStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange?.(status);
    }
  }
}
