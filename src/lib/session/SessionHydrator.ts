/**
 * SessionHydrator — validates persisted sessions and returns typed errors.
 *
 * It never throws (a corrupt localStorage blob must not crash the app). It layers
 * semantic validation on top of the serializer's structural parsing/migration.
 */

import { SessionSerializer, type SessionRecord } from './SessionSerializer';

export type HydrationErrorCode =
  | 'empty'
  | 'corrupt'
  | 'unknown-schema'
  | 'partial'
  | 'invalid-timestamp'
  | 'invalid-status';

export interface HydrationError {
  readonly code: HydrationErrorCode;
  readonly message: string;
}

export type HydrationResult =
  | { readonly ok: true; readonly record: SessionRecord; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly error: HydrationError };

const VALID_STATUSES = new Set(['created', 'running', 'paused', 'completed', 'cancelled']);
const REQUIRED_STRINGS = ['id', 'workoutId', 'status'] as const;
const REQUIRED_NON_NEGATIVE = [
  'cursorMs',
  'plannedRounds',
  'roundsCompleted',
  'plannedDurationMs',
  'activeDurationMs',
  'pausedDurationMs',
] as const;
const NULLABLE_TIMESTAMPS = ['startedAt', 'pausedAt', 'completedAt'] as const;

export class SessionHydrator {
  private readonly serializer: SessionSerializer;

  constructor(serializer: SessionSerializer = new SessionSerializer()) {
    this.serializer = serializer;
  }

  hydrate(raw: string | null): HydrationResult {
    if (raw == null || raw === '') {
      return fail('empty', 'no persisted session');
    }

    const parsed = this.serializer.deserialize(raw);
    if (!parsed.ok) {
      const code: HydrationErrorCode = parsed.error.code === 'unknown-schema' ? 'unknown-schema' : 'corrupt';
      return fail(code, parsed.error.message);
    }

    const validationError = validateRecord(parsed.record);
    if (validationError) return { ok: false, error: validationError };

    return { ok: true, record: parsed.record, migratedFrom: parsed.migratedFrom };
  }
}

function fail(code: HydrationErrorCode, message: string): HydrationResult {
  return { ok: false, error: { code, message } };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateRecord(record: any): HydrationError | null {
  if (!record || typeof record !== 'object' || typeof record.session !== 'object' || !record.session) {
    return { code: 'partial', message: 'missing session' };
  }
  const s = record.session;

  for (const field of REQUIRED_STRINGS) {
    if (typeof s[field] !== 'string' || s[field].length === 0) {
      return { code: 'partial', message: `missing or invalid "${field}"` };
    }
  }
  if (!VALID_STATUSES.has(s.status)) {
    return { code: 'invalid-status', message: `invalid status "${s.status}"` };
  }
  for (const field of REQUIRED_NON_NEGATIVE) {
    const v = s[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return { code: 'partial', message: `missing or invalid "${field}"` };
    }
  }
  for (const field of NULLABLE_TIMESTAMPS) {
    const v = s[field];
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      return { code: 'invalid-timestamp', message: `invalid timestamp "${field}"` };
    }
  }
  return null;
}
