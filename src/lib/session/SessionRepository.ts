/**
 * SessionRepository — session-aware persistence over a generic StorageAdapter.
 *
 * It (de)serializes + validates records and separates the single resumable
 * "active" slot from the "history" of finished sessions. Storage failures are
 * caught and reported to diagnostics (never crash the app).
 */

import type { StorageAdapter } from './StorageAdapter';
import { SessionSerializer, type SessionRecord } from './SessionSerializer';
import { SessionHydrator, type HydrationResult } from './SessionHydrator';
import type { SessionDiagnostics } from './SessionDiagnostics';

/** Promoted, immutable summary of a stored session (statistics live outside the engine). */
export interface SessionSummary {
  readonly id: string;
  readonly workoutId: string;
  readonly durationMs: number;
  readonly completedRounds: number;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly rating: number | null;
  readonly notes: string | null;
  readonly coach: string | null;
  /** Wall-clock time the record was written (when the live `now` is Date.now). */
  readonly savedAt: number;
  readonly status: string;
}

export function toSummary(record: SessionRecord): SessionSummary {
  const s = record.session;
  return {
    id: s.id,
    workoutId: s.workoutId,
    durationMs: s.activeDurationMs,
    completedRounds: s.roundsCompleted,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    rating: record.rating,
    notes: record.notes,
    coach: record.coach ?? null,
    savedAt: record.savedAt,
    status: s.status,
  };
}

export interface SessionRepositoryOptions {
  readonly prefix?: string;
  readonly diagnostics?: SessionDiagnostics;
}

export class SessionRepository {
  private readonly storage: StorageAdapter;
  private readonly serializer: SessionSerializer;
  private readonly hydrator: SessionHydrator;
  private readonly prefix: string;
  private readonly diagnostics?: SessionDiagnostics;

  constructor(
    storage: StorageAdapter,
    serializer: SessionSerializer = new SessionSerializer(),
    hydrator: SessionHydrator = new SessionHydrator(serializer),
    options: SessionRepositoryOptions = {}
  ) {
    this.storage = storage;
    this.serializer = serializer;
    this.hydrator = hydrator;
    this.prefix = options.prefix ?? 'corner:session';
    this.diagnostics = options.diagnostics;
  }

  private activeKey(): string {
    return `${this.prefix}:active`;
  }
  private historyKey(id: string): string {
    return `${this.prefix}:history:${id}`;
  }
  private historyPrefix(): string {
    return `${this.prefix}:history:`;
  }

  // --- Active (resumable) slot ---------------------------------------------
  async saveActive(record: SessionRecord): Promise<void> {
    await this.write(this.activeKey(), record);
  }
  async loadActive(): Promise<HydrationResult> {
    return this.read(this.activeKey());
  }
  async clearActive(): Promise<void> {
    await this.remove(this.activeKey());
  }

  // --- History --------------------------------------------------------------
  async appendHistory(record: SessionRecord): Promise<void> {
    await this.write(this.historyKey(record.session.id), record);
  }
  async getHistory(id: string): Promise<HydrationResult> {
    return this.read(this.historyKey(id));
  }
  async deleteHistory(id: string): Promise<void> {
    await this.remove(this.historyKey(id));
  }
  async clearHistory(): Promise<void> {
    const keys = (await this.safeKeys()).filter((k) => k.startsWith(this.historyPrefix()));
    for (const key of keys) await this.remove(key);
  }
  async listHistory(): Promise<SessionSummary[]> {
    const keys = (await this.safeKeys()).filter((k) => k.startsWith(this.historyPrefix()));
    const summaries: SessionSummary[] = [];
    for (const key of keys) {
      const result = await this.read(key);
      if (result.ok) summaries.push(toSummary(result.record));
    }
    return summaries;
  }
  /** Attach subjective rating/notes to a stored session (statistics, outside the engine). */
  async updateHistory(id: string, patch: { rating?: number | null; notes?: string | null }): Promise<boolean> {
    const result = await this.getHistory(id);
    if (!result.ok) return false;
    const updated: SessionRecord = {
      ...result.record,
      rating: patch.rating !== undefined ? patch.rating : result.record.rating,
      notes: patch.notes !== undefined ? patch.notes : result.record.notes,
    };
    await this.appendHistory(updated);
    return true;
  }

  // --- Internals ------------------------------------------------------------
  private async write(key: string, record: SessionRecord): Promise<void> {
    try {
      await this.storage.save(key, this.serializer.serialize(record));
    } catch (error) {
      this.diagnostics?.recordStorageError('save', error);
      throw error;
    }
  }

  private async read(key: string): Promise<HydrationResult> {
    let raw: string | null;
    try {
      raw = await this.storage.load(key);
    } catch (error) {
      this.diagnostics?.recordStorageError('load', error);
      return { ok: false, error: { code: 'corrupt', message: 'storage load failed' } };
    }
    const result = this.hydrator.hydrate(raw);
    if (result.ok && result.migratedFrom !== null) {
      this.diagnostics?.recordMigration(result.migratedFrom);
    }
    return result;
  }

  private async remove(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.diagnostics?.recordStorageError('delete', error);
    }
  }

  private async safeKeys(): Promise<string[]> {
    try {
      return await this.storage.keys();
    } catch (error) {
      this.diagnostics?.recordStorageError('keys', error);
      return [];
    }
  }
}
