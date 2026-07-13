/**
 * SessionSerializer — owns schemaVersion, migration, (de)serialization.
 *
 * All future schema evolution happens here: bump `PERSISTENCE_SCHEMA_VERSION`,
 * add a migration `n → n+1`, and old payloads upgrade on read. Serialization is
 * a versioned envelope wrapping the domain `SessionRecord`.
 */

import type { WorkoutSession } from '../engine';

export const PERSISTENCE_SCHEMA_VERSION = 2;

/** The persisted domain object: engine session + Session-Runtime-owned extras. */
export interface SessionRecord {
  readonly session: WorkoutSession; // objective, produced by the engine
  readonly rating: number | null; // subjective, owned by the Session Runtime
  readonly notes: string | null;
  readonly savedAt: number;
}

interface Envelope {
  readonly version: number;
  readonly record: SessionRecord;
}

export type SerializeErrorCode = 'corrupt' | 'unknown-schema';
export interface SerializeError {
  readonly code: SerializeErrorCode;
  readonly message: string;
}

export type DeserializeResult =
  | { readonly ok: true; readonly record: SessionRecord; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly error: SerializeError };

/* eslint-disable @typescript-eslint/no-explicit-any */
type RawEnvelope = any;
type Migration = (raw: RawEnvelope) => RawEnvelope;

/**
 * Migrations upgrade an envelope one version at a time. Built-in: v1 → v2 added
 * the `notes` field (defaults to null). This proves the evolution path is real.
 */
const BUILT_IN_MIGRATIONS: Record<number, Migration> = {
  1: (raw) => ({
    version: 2,
    record: { ...raw.record, notes: raw.record?.notes ?? null },
  }),
};

export class SessionSerializer {
  private readonly current: number;
  private readonly migrations: Record<number, Migration>;

  constructor(current = PERSISTENCE_SCHEMA_VERSION, migrations: Record<number, Migration> = BUILT_IN_MIGRATIONS) {
    this.current = current;
    this.migrations = migrations;
  }

  serialize(record: SessionRecord): string {
    const envelope: Envelope = { version: this.current, record };
    return JSON.stringify(envelope);
  }

  deserialize(raw: string): DeserializeResult {
    let parsed: RawEnvelope;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: { code: 'corrupt', message: 'invalid JSON' } };
    }

    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number' || typeof parsed.record !== 'object') {
      return { ok: false, error: { code: 'corrupt', message: 'malformed envelope' } };
    }

    let version: number = parsed.version;
    let migratedFrom: number | null = null;

    if (version > this.current) {
      return {
        ok: false,
        error: { code: 'unknown-schema', message: `version ${version} is newer than ${this.current}` },
      };
    }

    while (version < this.current) {
      const migrate = this.migrations[version];
      if (!migrate) {
        return { ok: false, error: { code: 'unknown-schema', message: `no migration from version ${version}` } };
      }
      migratedFrom = migratedFrom ?? version;
      parsed = migrate(parsed);
      if (!parsed || typeof parsed.version !== 'number' || parsed.version <= version) {
        return { ok: false, error: { code: 'corrupt', message: 'migration produced an invalid envelope' } };
      }
      version = parsed.version;
    }

    return { ok: true, record: parsed.record as SessionRecord, migratedFrom };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
