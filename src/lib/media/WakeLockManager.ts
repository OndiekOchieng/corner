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

/** Observability snapshot for verifying the wake lock on-device (PR-025 / 025 acceptance). */
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
  // --- Acceptance investigation evidence ------------------------------------
  /** Clock value at the last successful acquisition (null when not held). */
  readonly acquireTimeMs: number | null;
  /** How long the current sentinel has been held (null when not held). */
  readonly heldDurationMs: number | null;
  /** Why the lock last ended: a caller reason, or 'browser-release'. */
  readonly lastReleaseReason: string | null;
  /** Elapsed ms of the last `request('screen')` call. */
  readonly lastRequestMs: number | null;
  readonly lastRequestOutcome: 'resolved' | 'rejected' | null;
  /** `${name}: ${message}` of the last request rejection (e.g. NotAllowedError). */
  readonly lastError: string | null;
  /** document.visibilityState captured at the last browser-initiated release. */
  readonly lastReleaseVisibility: string | null;
}

export interface WakeLockManagerOptions {
  /** `null`/absent ⇒ Wake Lock unsupported. */
  readonly api?: WakeLockApiLike | null;
  readonly onStatusChange?: (status: WakeLockStatus) => void;
  /** Injected monotonic clock (for acquire-time / held-duration). Default performance.now/Date.now. */
  readonly now?: () => number;
}

/** Dev-only evidence log — stripped from production by the inline NODE_ENV check. */
function trace(msg: string): void {
  console.log(`[WakeLock] ${msg}`);
}

function docVisibility(): string {
  return typeof document !== 'undefined' ? document.visibilityState : 'n/a';
}
function docHidden(): string {
  return typeof document !== 'undefined' ? String(document.hidden) : 'n/a';
}
function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export class WakeLockManager {
  private readonly api: WakeLockApiLike | null;
  private readonly onStatusChange?: (status: WakeLockStatus) => void;
  private readonly now: () => number;
  private sentinel: WakeLockSentinelLike | null = null;
  /** The intended state — kept across browser-initiated releases so we can reacquire. */
  private wantActive = false;
  private status: WakeLockStatus;

  // Counters for verification (PR-025).
  private requested = 0;
  private acquired = 0;
  private releasedCount = 0;
  private reacquired = 0;

  // Acceptance-investigation evidence (PR-025 acceptance).
  private acquireTimeMs: number | null = null;
  private lastReleaseReason: string | null = null;
  private lastRequestMs: number | null = null;
  private lastRequestOutcome: 'resolved' | 'rejected' | null = null;
  private lastError: string | null = null;
  private lastReleaseVisibility: string | null = null;
  private sentinelId = 0;

  constructor(options: WakeLockManagerOptions = {}) {
    this.api = options.api ?? null;
    this.onStatusChange = options.onStatusChange;
    this.now = options.now ?? defaultNow;
    this.status = this.api ? 'released' : 'unsupported';
  }

  isSupported(): boolean {
    return this.api != null;
  }

  getStatus(): WakeLockStatus {
    return this.status;
  }

  stats(): WakeLockStats {
    const held = this.sentinel != null;
    return {
      supported: this.api != null,
      status: this.status,
      held,
      wanted: this.wantActive,
      requested: this.requested,
      acquired: this.acquired,
      released: this.releasedCount,
      reacquired: this.reacquired,
      acquireTimeMs: held ? this.acquireTimeMs : null,
      heldDurationMs: held && this.acquireTimeMs != null ? Math.round(this.now() - this.acquireTimeMs) : null,
      lastReleaseReason: this.lastReleaseReason,
      lastRequestMs: this.lastRequestMs,
      lastRequestOutcome: this.lastRequestOutcome,
      lastError: this.lastError,
      lastReleaseVisibility: this.lastReleaseVisibility,
    };
  }

  async acquire(reason = 'acquire'): Promise<boolean> {
    this.wantActive = true;
    if (!this.api) {
      process.env.NODE_ENV === 'development' && trace(`${reason}: unsupported (navigator.wakeLock absent)`);
      return false;
    }
    if (this.sentinel) {
      process.env.NODE_ENV === 'development' && trace(`${reason}: already-held (sentinel #${this.sentinelId})`);
      return true;
    }

    this.requested += 1;
    const t0 = this.now();
    process.env.NODE_ENV === 'development' &&
      trace(`${reason}: request BEGIN · vis=${docVisibility()} hidden=${docHidden()}`);
    try {
      const sentinel = await this.api.request('screen');
      const elapsed = Math.round(this.now() - t0);
      this.lastRequestMs = elapsed;
      this.lastRequestOutcome = 'resolved';
      this.lastError = null;
      this.sentinel = sentinel;
      this.acquired += 1;
      this.sentinelId += 1;
      this.acquireTimeMs = this.now();
      const id = this.sentinelId;
      process.env.NODE_ENV === 'development' &&
        trace(`${reason}: request END resolved in ${elapsed}ms · sentinel #${id} · held=true`);
      // The browser releases the lock when the tab hides / on OS policy; capture the
      // full context so we can tell WHY the screen slept.
      sentinel.addEventListener('release', () => {
        const heldMs = this.acquireTimeMs != null ? Math.round(this.now() - this.acquireTimeMs) : null;
        this.sentinel = null;
        this.acquireTimeMs = null;
        this.lastReleaseReason = 'browser-release';
        this.lastReleaseVisibility = docVisibility();
        if (this.status === 'active') this.setStatus('released');
        process.env.NODE_ENV === 'development' &&
          trace(`browser-release: sentinel #${id} · vis=${docVisibility()} hidden=${docHidden()} heldMs=${heldMs}`);
      });
      this.setStatus('active');
      return true;
    } catch (e) {
      const elapsed = Math.round(this.now() - t0);
      const err = e as { name?: string; message?: string };
      this.lastRequestMs = elapsed;
      this.lastRequestOutcome = 'rejected';
      this.lastError = `${err?.name ?? 'Error'}: ${err?.message ?? ''}`.trim();
      this.setStatus('released');
      process.env.NODE_ENV === 'development' &&
        trace(`${reason}: request END REJECTED in ${elapsed}ms · ${this.lastError}`);
      return false; // denied / not visible — a later visible/gesture retries
    }
  }

  async release(reason = 'release'): Promise<void> {
    this.wantActive = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    this.acquireTimeMs = null;
    if (sentinel) {
      this.releasedCount += 1;
      try {
        // NOTE: this fires the sentinel's 'release' event (which sets the reason to
        // 'browser-release'), so set the caller's reason AFTER it to win.
        await sentinel.release();
      } catch {
        /* best-effort */
      }
    }
    this.lastReleaseReason = reason;
    if (this.api) this.setStatus('released');
    process.env.NODE_ENV === 'development' &&
      trace(`${reason}: ${sentinel ? 'released' : 'nothing-to-release'} · vis=${docVisibility()}`);
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
