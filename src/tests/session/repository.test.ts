import { describe, it, expect } from 'vitest';
import {
  InMemoryStorageAdapter,
  SessionRepository,
  SessionSerializer,
  SessionHydrator,
  SessionDiagnostics,
  HistoryService,
  type StorageAdapter,
} from '../../lib/session';
import { sessionAt, completedSession, recordFrom } from './helpers';

function makeRepo(diagnostics?: SessionDiagnostics, storage: StorageAdapter = new InMemoryStorageAdapter()) {
  const serializer = new SessionSerializer();
  const hydrator = new SessionHydrator(serializer);
  return new SessionRepository(storage, serializer, hydrator, { diagnostics });
}

describe('SessionRepository — active slot', () => {
  it('saves, loads, and clears the resumable session', async () => {
    const repo = makeRepo();
    await repo.saveActive(recordFrom(sessionAt(25000)));

    const loaded = await repo.loadActive();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.record.session.cursorMs).toBe(25000);

    await repo.clearActive();
    expect((await repo.loadActive()).ok).toBe(false);
  });
});

describe('SessionRepository — history', () => {
  it('appends, lists, gets, deletes, and clears history', async () => {
    const repo = makeRepo();
    const a = recordFrom(completedSession());
    await repo.appendHistory(a);

    const summaries = await repo.listHistory();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: a.session.id,
      completedRounds: 3,
      status: 'completed',
    });

    const got = await repo.getHistory(a.session.id);
    expect(got.ok).toBe(true);

    await repo.deleteHistory(a.session.id);
    expect(await repo.listHistory()).toHaveLength(0);
  });

  it('attaches rating/notes via updateHistory', async () => {
    const repo = makeRepo();
    const rec = recordFrom(completedSession());
    await repo.appendHistory(rec);
    expect(await repo.updateHistory(rec.session.id, { rating: 5, notes: 'strong' })).toBe(true);
    const summaries = await repo.listHistory();
    expect(summaries[0]).toMatchObject({ rating: 5, notes: 'strong' });
  });
});

describe('HistoryService (pure service)', () => {
  it('exposes list/get/delete/clear/rate', async () => {
    const repo = makeRepo();
    const history = new HistoryService(repo);
    const rec = recordFrom(completedSession());
    await repo.appendHistory(rec);

    expect(await history.listSessions()).toHaveLength(1);
    expect((await history.getSession(rec.session.id))?.id).toBe(rec.session.id);
    expect(await history.getSession('missing')).toBeNull();
    await history.rateSession(rec.session.id, 3);
    expect((await history.listSessions())[0].rating).toBe(3);
    await history.clear();
    expect(await history.listSessions()).toHaveLength(0);
  });
});

describe('SessionRepository — storage errors', () => {
  it('reports save failures to diagnostics', async () => {
    const failing: StorageAdapter = {
      load: async () => null,
      save: async () => {
        throw new Error('quota exceeded');
      },
      delete: async () => {},
      exists: async () => false,
      keys: async () => [],
    };
    const diag = new SessionDiagnostics(() => 0);
    const repo = makeRepo(diag, failing);
    await expect(repo.saveActive(recordFrom(sessionAt(1000)))).rejects.toThrow('quota exceeded');
    expect(diag.snapshot().storageErrorCount).toBe(1);
    expect(diag.snapshot().recentStorageErrors[0].op).toBe('save');
  });

  it('records a migration when reading an older payload', async () => {
    const storage = new InMemoryStorageAdapter();
    const diag = new SessionDiagnostics(() => 0);
    const repo = makeRepo(diag, storage);
    // Write a v1 payload directly.
    const base = recordFrom(sessionAt(5000));
    await storage.save(
      'corner:session:active',
      JSON.stringify({ version: 1, record: { session: base.session, rating: null, savedAt: 0 } })
    );
    const loaded = await repo.loadActive();
    expect(loaded.ok).toBe(true);
    expect(diag.snapshot().migrationCount).toBe(1);
  });
});
