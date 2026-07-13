/**
 * SessionDiagnostics — observability for the Session Runtime.
 *
 * Deliberately SEPARATE from the Event Runtime's `RuntimeDiagnostics`: the
 * Session Runtime owns persistence, so it owns persistence diagnostics. This
 * keeps the Event Runtime unchanged (per the DoD: "runtime remains unchanged
 * except composition") and avoids coupling event delivery to storage concerns.
 *
 * Tracks: checkpoint count / last checkpoint, restore count, failed restores,
 * migration count, and storage errors. Exposes immutable snapshots only; reading
 * never affects behaviour.
 */

import { systemNow, type NowFn } from '../platform/time';

export type { NowFn };

export interface StorageErrorEntry {
  readonly op: string;
  readonly message: string;
  readonly at: number;
}

export interface SessionDiagnosticsSnapshot {
  readonly checkpointCount: number;
  readonly lastCheckpointAt: number | null;
  readonly restoreCount: number;
  readonly failedRestores: number;
  readonly migrationCount: number;
  readonly storageErrorCount: number;
  readonly recentStorageErrors: readonly StorageErrorEntry[];
}

const MAX_RECENT_STORAGE_ERRORS = 50;

export class SessionDiagnostics {
  private readonly now: NowFn;

  private checkpointCount = 0;
  private lastCheckpointAt: number | null = null;
  private restoreCount = 0;
  private failedRestores = 0;
  private migrationCount = 0;
  private storageErrors: StorageErrorEntry[] = [];

  constructor(now: NowFn = systemNow) {
    this.now = now;
  }

  recordCheckpoint(): void {
    this.checkpointCount += 1;
    this.lastCheckpointAt = this.now();
  }

  recordRestore(): void {
    this.restoreCount += 1;
  }

  recordFailedRestore(): void {
    this.failedRestores += 1;
  }

  recordMigration(_fromVersion: number): void {
    this.migrationCount += 1;
  }

  recordStorageError(op: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.storageErrors.push({ op, message, at: this.now() });
    if (this.storageErrors.length > MAX_RECENT_STORAGE_ERRORS) this.storageErrors.shift();
  }

  snapshot(): SessionDiagnosticsSnapshot {
    return {
      checkpointCount: this.checkpointCount,
      lastCheckpointAt: this.lastCheckpointAt,
      restoreCount: this.restoreCount,
      failedRestores: this.failedRestores,
      migrationCount: this.migrationCount,
      storageErrorCount: this.storageErrors.length,
      recentStorageErrors: this.storageErrors.slice(),
    };
  }
}
