import { describe, it, expect } from 'vitest';
import { FakeClock } from '../../lib/engine';
import {
  InMemoryStorageAdapter,
  SessionRepository,
  SessionSerializer,
  SessionHydrator,
  SessionDiagnostics,
  SessionManager,
} from '../../lib/session';
import { makeConfig } from '../fixtures';
import { sessionAt, completedSession, recordFrom } from './helpers';

function makeManager(storage = new InMemoryStorageAdapter()) {
  const serializer = new SessionSerializer();
  const diag = new SessionDiagnostics(() => 0);
  const repo = new SessionRepository(storage, serializer, new SessionHydrator(serializer), { diagnostics: diag });
  const manager = new SessionManager({
    repository: repo,
    resolveConfig: (id) => (id === 'w1' ? makeConfig() : null),
    diagnostics: diag,
    now: () => 0,
  });
  return { manager, repo, storage, diag };
}

describe('SessionManager — resume discovery', () => {
  it('returns "none" when nothing is stored', async () => {
    const { manager } = makeManager();
    expect(await manager.loadResumable()).toEqual({ kind: 'none' });
  });

  it('returns a resumable record for an unfinished session', async () => {
    const { manager, repo } = makeManager();
    await repo.saveActive(recordFrom(sessionAt(25000))); // running
    const outcome = await manager.loadResumable();
    expect(outcome.kind).toBe('resumable');
    if (outcome.kind === 'resumable') expect(outcome.record.session.cursorMs).toBe(25000);
  });

  it('treats a terminal (completed) active slot as not resumable', async () => {
    const { manager, repo } = makeManager();
    await repo.saveActive(recordFrom(completedSession()));
    expect(await manager.loadResumable()).toEqual({ kind: 'none' });
  });

  it('reports a corrupt active slot as an error and counts a failed restore', async () => {
    const storage = new InMemoryStorageAdapter();
    const { manager, diag } = makeManager(storage);
    await storage.save('corner:session:active', 'not-json');
    const outcome = await manager.loadResumable();
    expect(outcome.kind).toBe('error');
    expect(diag.snapshot().failedRestores).toBe(1);
  });

  it('discards the resumable slot on request', async () => {
    const { manager, repo } = makeManager();
    await repo.saveActive(recordFrom(sessionAt(25000)));
    await manager.discardResumable();
    expect((await repo.loadActive()).ok).toBe(false);
  });
});

describe('SessionManager — restore + diagnostics', () => {
  it('primes an engine and records a restore', () => {
    const { manager, diag } = makeManager();
    const restored = manager.restore(recordFrom(sessionAt(25000)), new FakeClock(0));
    expect(restored).not.toBeNull();
    expect(restored?.engine.snapshot().elapsedMs).toBe(25000);
    expect(diag.snapshot().restoreCount).toBe(1);
  });

  it('fails safely when the workout config cannot be resolved', () => {
    const { manager, diag } = makeManager();
    const record = recordFrom(sessionAt(25000));
    const orphan = recordFrom({ ...record.session, workoutId: 'unknown' });
    expect(manager.restore(orphan, new FakeClock(0))).toBeNull();
    expect(diag.snapshot().failedRestores).toBe(1);
  });
});

describe('SessionManager — history + restart flow', () => {
  it('completed sessions appear in history; the active slot is free to restart', async () => {
    const { manager, repo } = makeManager();
    await repo.appendHistory(recordFrom(completedSession()));
    await repo.clearActive();

    expect(await manager.history.listSessions()).toHaveLength(1);
    expect(await manager.loadResumable()).toEqual({ kind: 'none' }); // ready for a fresh workout
  });
});
