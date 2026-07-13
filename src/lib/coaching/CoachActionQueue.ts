/**
 * CoachActionQueue — the ordered buffer of pending coaching actions.
 *
 * A small, policy-free data structure: it keeps actions sorted in the
 * deterministic priority order (PriorityResolver.compare) and offers the
 * primitive operations. All *decisions* (replace, overflow, expiry, interrupt)
 * live in QueueManager; this just stores and orders.
 */

import { compare } from './PriorityResolver';
import type { CoachAction } from './CoachAction';

export class CoachActionQueue {
  private items: CoachAction[] = [];

  get size(): number {
    return this.items.length;
  }

  /** Insert, keeping the buffer sorted by priority (desc), then age, then seq. */
  insert(action: CoachAction): void {
    this.items.push(action);
    this.items.sort(compare);
  }

  /** Read-only, priority-ordered view. */
  list(): readonly CoachAction[] {
    return this.items;
  }

  /** Remove and return every action matching the predicate. */
  removeWhere(predicate: (a: CoachAction) => boolean): CoachAction[] {
    const removed: CoachAction[] = [];
    this.items = this.items.filter((a) => {
      if (predicate(a)) {
        removed.push(a);
        return false;
      }
      return true;
    });
    return removed;
  }

  /** Empty the buffer, returning its contents in priority order. */
  takeAll(): CoachAction[] {
    const all = this.items;
    this.items = [];
    return all;
  }

  clear(): CoachAction[] {
    return this.takeAll();
  }
}
