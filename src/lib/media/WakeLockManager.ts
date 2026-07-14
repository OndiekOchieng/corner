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

/** Observability snapshot for verifying the wake lock on-device (PR-025). */
export interface WakeLockStats {
  readonly supported: boolean;
  readonly status: WakeLockStatus;
  /** True while a sentinel is genuinely held right now. */
  readonly held: boolean;
  /** Whether a lock is currently wanted (kept across browser-initiated releases). */
  readonly wanted: boolean;
  /** `request('screen')` attempts. */
  readonly requested: number;
  /** Successful sentinels obtained. */
  readonly acquired: number;
  /** Explicit releases performed. */
  readonly released: number;
  /** Re-acquisitions after a visibility-driven drop. */
  readonly reacquired: number;
}

export interface WakeLockManagerOptions {
  /** `null`/absent ⇒ Wake Lock unsupported. */
  readonly api?: WakeLockApiLike | null;
  readonly onStatusChange?: (status: WakeLockStatus) => void;
}

/** Dev-only reason log — stripped from production by the inline NODE_ENV check. */
function trace(reason: string, outcome: string): void {
  console.log(`[WakeLock] ${reason} → ${outcome}`);
}

export class WakeLockManager {
  private readonly api: WakeLockApiLike | null;
  private readonly onStatusChange?: (status: WakeLockStatus) => void;
  private sentinel: WakeLockSentinelLike | null = null;
  /** The intended state — kept across browser-initiated releases so we can reacquire. */
  private wantActive = false;
  private status: WakeLockStatus;

  // Counters for verification (PR-025).
  private requested = 0;
  private acquired = 0;
  private releasedCount = 0;
  private reacquired = 0;

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

  stats(): WakeLockStats {
    return {
      supported: this.api != null,
      status: this.status,
      held: this.sentinel != null,
      wanted: this.wantActive,
      requested: this.requested,
      acquired: this.acquired,
      released: this.releasedCount,
      reacquired: this.reacquired,
    };
  }

  async acquire(reason = 'acquire'): Promise<boolean> {
    this.wantActive = true;
    if (!this.api) {
      process.env.NODE_ENV === 'development' && trace(reason, 'unsupported');
      return false;
    }
    if (this.sentinel) {
      process.env.NODE_ENV === 'development' && trace(reason, 'already-held');
      return true;
    }

    this.requested += 1;
    try {
      const sentinel = await this.api.request('screen');
      this.sentinel = sentinel;
      this.acquired += 1;
      // The browser releases the lock when the tab hides; note that so a later
      // visibility change can reacquire.
      sentinel.addEventListener('release', () => {
        this.sentinel = null;
        if (this.status === 'active') this.setStatus('released');
        process.env.NODE_ENV === 'development' && trace('browser-release', 'dropped (tab hidden)');
      });
      this.setStatus('active');
      process.env.NODE_ENV === 'development' && trace(reason, 'acquired');
      return true;
    } catch {
      this.setStatus('released');
      // e.g. denied / not visible — a later visible/gesture retries.
      process.env.NODE_ENV === 'development' && trace(reason, 'request rejected');
      return false;
    }
  }

  async release(reason = 'release'): Promise<void> {
    this.wantActive = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) {
      this.releasedCount += 1;
      try {
        await sentinel.release();
      } catch {
        /* best-effort */
      }
    }
    if (this.api) this.setStatus('released');
    process.env.NODE_ENV === 'development' && trace(reason, sentinel ? 'released' : 'nothing-to-release');
  }

  /** Reacquire after returning to visibility, if a lock is still wanted. */
  async reacquireIfWanted(reason = 'visibility-reacquire'): Promise<void> {
    if (this.wantActive && !this.sentinel) {
      const ok = await this.acquire(reason);
      if (ok) this.reacquired += 1;
    }
  }

  private setStatus(status: WakeLockStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange?.(status);
    }
  }
}
