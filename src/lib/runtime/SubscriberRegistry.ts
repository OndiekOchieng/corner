/**
 * SubscriberRegistry — owns the set of subscribers and their deterministic
 * delivery order (priority descending, ties broken by registration order).
 *
 * The sorted array is maintained on mutation, so `ordered()` is allocation-free
 * on the hot path (each dispatch reuses the cached order).
 */

import { DuplicateSubscriberError, type Subscriber } from './Subscriber';
import type { RegisteredSubscriber } from './types';

interface Entry {
  readonly subscriber: Subscriber;
  readonly seq: number;
}

export class SubscriberRegistry {
  private entries: Entry[] = [];
  private ids = new Set<string>();
  private counter = 0;
  private orderedCache: readonly Subscriber[] = [];

  register(subscriber: Subscriber): void {
    if (this.ids.has(subscriber.id)) {
      throw new DuplicateSubscriberError(subscriber.id);
    }
    this.ids.add(subscriber.id);
    this.entries.push({ subscriber, seq: this.counter++ });
    this.resort();
  }

  unregister(id: string): boolean {
    if (!this.ids.has(id)) return false;
    this.ids.delete(id);
    this.entries = this.entries.filter((e) => e.subscriber.id !== id);
    this.resort();
    return true;
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  clear(): void {
    this.entries = [];
    this.ids.clear();
    this.orderedCache = [];
  }

  count(): number {
    return this.entries.length;
  }

  /** Subscribers in deterministic delivery order (cached). */
  ordered(): readonly Subscriber[] {
    return this.orderedCache;
  }

  list(): RegisteredSubscriber[] {
    return this.orderedCache.map((s) => ({ id: s.id, priority: s.priority }));
  }

  private resort(): void {
    const sorted = this.entries.slice().sort((a, b) => {
      if (a.subscriber.priority !== b.subscriber.priority) {
        return b.subscriber.priority - a.subscriber.priority; // higher first
      }
      return a.seq - b.seq; // stable: earlier registration first
    });
    this.orderedCache = sorted.map((e) => e.subscriber);
  }
}
