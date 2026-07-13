/**
 * QueueManager — orders, expires, and renders coaching actions.
 *
 * Coaching decisions are produced per event; the queue buffers a batch, applies
 * priority/replace/expiry policy, then drains to the SpeechSink. Because the sink
 * (SpeechService) already guarantees non-overlapping playback, the queue's job is
 * ordering + hygiene:
 *
 *   enqueue  — add, replacing an unspoken same-intent line and discarding the
 *              lowest-priority overflow past maxDepth.
 *   expire   — drop actions whose engine-elapsed TTL has passed (never spoken).
 *   flush    — drop everything (used on resume so stale coaching never replays).
 *   drain    — expire, then render in deterministic priority order; a critical
 *              action that outranks the last-rendered line cancels it (interrupt).
 *
 * Storage is delegated to CoachActionQueue; this class owns the policy. All
 * timing is the engine's `elapsedMs`; there is no wall-clock here.
 */

import { CoachActionQueue } from './CoachActionQueue';
import { shouldInterrupt } from './PriorityResolver';
import type { CoachAction, SpeechSink } from './CoachAction';

export interface DrainResult {
  readonly spoken: readonly CoachAction[];
  readonly interruptions: number;
  readonly expired: readonly CoachAction[];
  readonly peakDepth: number;
}

export class QueueManager {
  private readonly queue = new CoachActionQueue();
  private peakDepth = 0;
  /** The last line actually rendered, across batches — used for interruption. */
  private lastRendered: CoachAction | null = null;

  constructor(private readonly maxDepth: number) {}

  get depth(): number {
    return this.queue.size;
  }

  /** Add an action. Returns any actions displaced (replaced or overflowed). */
  enqueue(action: CoachAction): CoachAction[] {
    // Replace an unspoken same-intent line — keep the freshest wording.
    const discarded = this.queue.removeWhere((a) => a.intent === action.intent);
    this.queue.insert(action);

    // Overflow: drop the lowest-priority action(s) beyond the cap.
    if (this.queue.size > this.maxDepth) {
      const overflow = new Set(this.queue.list().slice(this.maxDepth));
      discarded.push(...this.queue.removeWhere((a) => overflow.has(a)));
    }

    if (this.queue.size > this.peakDepth) this.peakDepth = this.queue.size;
    return discarded;
  }

  /** Remove and return actions whose TTL has elapsed. */
  expire(nowMs: number): CoachAction[] {
    return this.queue.removeWhere(
      (a) => a.expiresElapsedMs != null && a.expiresElapsedMs <= nowMs,
    );
  }

  /** Drop everything pending (resume / cancel). Returns what was dropped. */
  flush(): CoachAction[] {
    return this.queue.clear();
  }

  /**
   * Render the batch: expire stale actions, then speak in priority order.
   * A critical action that outranks the last-rendered line cancels it first.
   */
  drain(sink: SpeechSink, nowMs: number): DrainResult {
    const expired = this.expire(nowMs);
    const ordered = this.queue.takeAll();

    const spoken: CoachAction[] = [];
    let interruptions = 0;

    for (const action of ordered) {
      if (shouldInterrupt(action, this.lastRendered)) {
        sink.cancel();
        interruptions += 1;
      }
      sink.speak(action.text);
      spoken.push(action);
      this.lastRendered = action;
    }

    return { spoken, interruptions, expired, peakDepth: this.peakDepth };
  }

  reset(): void {
    this.queue.clear();
    this.peakDepth = 0;
    this.lastRendered = null;
  }
}
