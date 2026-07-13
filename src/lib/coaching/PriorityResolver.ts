/**
 * PriorityResolver — deterministic rules for competing coaching actions.
 *
 * When more than one line wants the air, the resolver decides who wins and
 * whether the winner interrupts. The rules are fixed and total (a strict order),
 * so the same competition always resolves the same way.
 *
 *   Critical (countdown, finish) > structural intros > urgency > correction >
 *   instruction > reminder > teaching > recovery > encouragement.
 */

import {
  basePriority,
  isCritical,
  type CoachAction,
  type CoachIntent,
} from './CoachAction';

/** Base priority for an intent (before any situational bump). */
export function priorityFor(intent: CoachIntent): number {
  return basePriority(intent);
}

/**
 * Does `incoming` cut off the last-rendered line? Only a critical intent
 * (countdown, finish) interrupts, and only when it outranks what was last
 * spoken. That means the countdown cuts through lingering chatter exactly once
 * (the "Ten seconds") and then flows — consecutive count numbers share priority
 * and never cancel each other (TIMING_MODEL.md §7).
 */
export function shouldInterrupt(incoming: CoachAction, current: CoachAction | null): boolean {
  if (!isCritical(incoming.intent)) return false;
  if (!current) return false;
  return current.priority < incoming.priority;
}

/**
 * Total order for the queue: priority desc, then earlier creation, then seq —
 * fully deterministic, never depends on insertion timing.
 */
export function compare(a: CoachAction, b: CoachAction): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.createdElapsedMs !== b.createdElapsedMs) return a.createdElapsedMs - b.createdElapsedMs;
  return a.sourceSeq - b.sourceSeq;
}
