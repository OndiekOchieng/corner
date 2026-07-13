/**
 * HistoryService — a pure service over the repository (no UI).
 *
 * listSessions / getSession / deleteSession / clear (+ rateSession to attach the
 * subjective rating/notes that live outside the engine).
 */

import type { SessionRepository, SessionSummary } from './SessionRepository';
import type { WorkoutSession } from '../engine';

export class HistoryService {
  private readonly repository: SessionRepository;

  constructor(repository: SessionRepository) {
    this.repository = repository;
  }

  listSessions(): Promise<SessionSummary[]> {
    return this.repository.listHistory();
  }

  async getSession(id: string): Promise<WorkoutSession | null> {
    const result = await this.repository.getHistory(id);
    return result.ok ? result.record.session : null;
  }

  deleteSession(id: string): Promise<void> {
    return this.repository.deleteHistory(id);
  }

  clear(): Promise<void> {
    return this.repository.clearHistory();
  }

  rateSession(id: string, rating: number | null, notes?: string | null): Promise<boolean> {
    return this.repository.updateHistory(id, { rating, notes: notes ?? undefined });
  }
}
