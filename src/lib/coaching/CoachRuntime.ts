/**
 * CoachRuntime — the orchestrator that owns coaching judgement.
 *
 *   event → Director (what shape?) → Silence (speak at all?) → Planner (which
 *   words?) → repetition guard → Queue (order/expire/interrupt) → SpeechSink
 *
 * It consumes immutable engine events and drives the existing SpeechService via
 * the narrow `SpeechSink` port. It never synthesizes speech, never touches the
 * engine, and uses only the engine's deterministic `elapsedMs` for timing — so
 * the same event stream always produces the same coaching.
 *
 * Guarantees:
 *   - No duplicated coaching: each event is handled once; repeated wording is
 *     deduped; out-of-order/replayed events (seq ≤ last) are ignored.
 *   - No replay after resume: WORKOUT_RESUMED flushes stale pending; the engine's
 *     restorer already withholds pre-cursor events.
 *   - Deterministic: no wall-clock, no randomness.
 */

import type { WorkoutEvent } from '../engine';
import {
  isCritical,
  isStructural,
  validityTtlMs,
  estimateSpeechMs,
  type CoachAction,
  type CoachIntent,
  type SpeechSink,
} from './CoachAction';
import type { CoachContext } from './CoachContext';
import { CoachingMemory } from './CoachingMemory';
import { CoachDirector, type DirectedIntent } from './CoachDirector';
import { SpeechPlanner } from './SpeechPlanner';
import { decideSilence } from './SilenceController';
import { priorityFor } from './PriorityResolver';
import { QueueManager } from './QueueManager';
import { CoachDiagnostics, type CoachDiagnosticsSnapshot } from './CoachDiagnostics';
import { personalityFor, type PersonalityProfile } from './personalities';
import { nextUntaughtSign, callSign } from './BoxingLexicon';

/**
 * Countdown beats, seconds remaining — mirrors the engine's default thresholds
 * (Marker.ts DEFAULT_COUNTDOWN_LEAD_SECONDS). Descending, so the first beat that
 * fits the remaining time is the SOONEST one. Used to decide whether a coaching
 * line can finish before "Ten… Nine…" (PR-021). Not an engine import — a small,
 * documented mirror the coach reasons against.
 */
const COUNTDOWN_THRESHOLDS_SEC = [10, 5, 4, 3, 2, 1] as const;

/** A small safety margin over the speech estimate, so a line clears the beat cleanly. */
const COUNTDOWN_PREEMPT_BUFFER_MS = 250;

export class CoachRuntime {
  private readonly convo: CoachingMemory;
  private readonly director: CoachDirector;
  private readonly planner: SpeechPlanner;
  private readonly queue: QueueManager;
  private readonly diagnostics = new CoachDiagnostics();
  private readonly profile: PersonalityProfile;
  private lastSeq = -1;

  constructor(
    private readonly context: CoachContext,
    private readonly sink: SpeechSink,
  ) {
    this.profile = personalityFor(context.personality);
    this.convo = new CoachingMemory(context.config.dedupeWindow);
    this.director = new CoachDirector(context);
    this.planner = new SpeechPlanner(this.profile);
    this.queue = new QueueManager(context.config.maxQueueDepth);
  }

  /** Handle one engine event. Returns the lines actually sent to the sink. */
  onEvent(event: WorkoutEvent): readonly CoachAction[] {
    // A new session resets memory; otherwise ignore replays (seq must advance).
    if (event.type === 'WORKOUT_STARTED') {
      this.convo.reset();
      this.queue.reset();
      this.lastSeq = event.seq;
    } else if (event.seq <= this.lastSeq) {
      return [];
    } else {
      this.lastSeq = event.seq;
    }

    this.diagnostics.recordElapsed(event.elapsedMs);

    // Control events operate the sink; they never speak.
    switch (event.type) {
      case 'WORKOUT_PAUSED':
        this.sink.pause();
        return [];
      case 'WORKOUT_RESUMED': {
        // Speech is a LIVE view of the timeline (PR-021), not a recording. Drop
        // the coach's pending queue AND anything buffered or mid-utterance in the
        // sink from before the pause — so a stale intro/cue never replays while the
        // athlete is already further into the workout — then un-pause for NOW. The
        // ongoing event stream supplies coaching appropriate to the current point.
        const dropped = this.queue.flush();
        this.diagnostics.recordDiscarded(dropped.length);
        this.sink.cancel();
        this.sink.resume();
        return [];
      }
      case 'WORKOUT_CANCELLED': {
        const dropped = this.queue.flush();
        this.diagnostics.recordDiscarded(dropped.length);
        this.sink.cancel();
        return [];
      }
      default:
        break;
    }

    const candidates = this.director.direct(event, this.convo);
    for (const candidate of candidates) {
      this.consider(candidate, event);
    }

    const result = this.queue.drain(this.sink, event.elapsedMs);
    for (const action of result.spoken) this.diagnostics.recordSpoken(action.intent);
    this.diagnostics.recordInterruptions(result.interruptions);
    this.diagnostics.recordExpired(result.expired.length);
    this.diagnostics.recordQueueDepth(this.queue.depth, result.peakDepth);
    return result.spoken;
  }

  /** Run one candidate through silence → planning → dedup, and enqueue it. */
  private consider(candidate: DirectedIntent, event: WorkoutEvent): void {
    const snap = this.convo.snapshot();
    const decision = decideSilence(
      candidate.intent,
      snap,
      candidate.params,
      this.context.config,
      this.profile,
      event.elapsedMs,
    );
    if (!decision.speak) {
      this.diagnostics.recordSilence();
      return;
    }

    const text = this.resolveText(candidate, event.elapsedMs);
    if (text == null) return;

    // Structural-deadline preemption (PR-021): never START a coaching line that
    // cannot finish before the round's countdown — skip it rather than let
    // "Ten… Nine…" cut it off. The countdown/finish trust skeleton is exempt.
    if (this.wouldMissCountdown(candidate.intent, text, event.elapsedMs)) {
      this.diagnostics.recordSilence();
      return;
    }

    const action = this.buildAction(candidate.intent, text, event, candidate.ttlMs);
    // Commit to conversation memory now so later candidates in this same batch
    // (e.g. teaching after the rest intro) see it and space themselves. The
    // dimension is recorded so the next same-dimension cue reinforces (varies).
    this.convo.noteSpoken(candidate.intent, text, event.elapsedMs, candidate.params.dimension);
    // Teach-before-shorthand (PR-020D): mark the call sign introduced ONLY now
    // that the combination line is committed to be spoken — a combo silenced by
    // the density gate above never falsely counts as taught.
    if (candidate.intent === 'combination' && candidate.params.combination) {
      const sign = nextUntaughtSign(candidate.params.combination, this.profile.id, this.convo);
      if (sign != null) this.convo.noteCallSignIntroduced(callSign(sign));
    }
    this.diagnostics.recordGenerated();

    const discarded = this.queue.enqueue(action);
    if (discarded.length) this.diagnostics.recordDiscarded(discarded.length);
  }

  /** Plan wording with repetition avoidance (one re-roll, then give up). */
  private resolveText(candidate: DirectedIntent, nowMs: number): string | null {
    const { intent, params } = candidate;

    // Exact-text reminder cooldown — don't loop the same reminder.
    if (intent === 'reminder' && params.cueText) {
      if (this.convo.wasReminderRecent(params.cueText, nowMs, this.context.config.reminderCooldownMs)) {
        this.diagnostics.recordRepetitionAvoided();
        return null;
      }
    }

    let text = this.planner.plan(intent, params, this.convo);
    if (text == null) return null;

    if (this.isRepeatDrop(intent, text)) {
      const retry = this.planner.plan(intent, params, this.convo, 1);
      if (retry == null || this.isRepeatDrop(intent, retry)) {
        this.diagnostics.recordRepetitionAvoided();
        return null;
      }
      text = retry;
    }
    return text;
  }

  private isRepeatDrop(intent: CoachIntent, text: string): boolean {
    // Structural lines vary by design and must always land; only guard chatter.
    if (intent === 'countdown' || intent === 'finish') return false;
    return this.convo.hasRecentText(text);
  }

  /**
   * True when a coaching line, started now, could NOT finish before the next
   * countdown beat (or the round's end) — so it would be cut by "Ten… Nine…" and
   * must be skipped rather than started (PR-021). Structural + critical intents
   * (the trust skeleton) are exempt and always land. Deterministic: the beats are
   * the engine's fixed thresholds, measured against the round-end deadline in
   * engine `elapsedMs`.
   */
  private wouldMissCountdown(intent: CoachIntent, text: string, nowMs: number): boolean {
    if (isStructural(intent) || isCritical(intent)) return false;
    const deadline = this.nextStructuralDeadlineMs(nowMs);
    if (deadline == null) return false;
    return nowMs + estimateSpeechMs(text) + COUNTDOWN_PREEMPT_BUFFER_MS > deadline;
  }

  /**
   * The next moment the countdown "owns the air": the soonest countdown beat at or
   * after now, or the round end. Null when we're not inside a live round (during
   * rest / at the boundary there is no deadline to respect).
   */
  private nextStructuralDeadlineMs(nowMs: number): number | null {
    const roundEnd = this.convo.roundEndsAtMs();
    if (roundEnd == null || nowMs >= roundEnd) return null;
    const remainingMs = roundEnd - nowMs;
    for (const t of COUNTDOWN_THRESHOLDS_SEC) {
      const beatMs = t * 1000;
      if (beatMs <= remainingMs) return roundEnd - beatMs; // the next beat
    }
    return roundEnd; // past the last beat → the round end itself
  }

  private buildAction(
    intent: CoachIntent,
    text: string,
    event: WorkoutEvent,
    ttlMs?: number,
  ): CoachAction {
    return {
      id: `${event.seq}:${intent}`,
      intent,
      priority: priorityFor(intent),
      text,
      sourceSeq: event.seq,
      createdElapsedMs: event.elapsedMs,
      // Temporal validity (PR-021): an explicit ttl (e.g. urgency) wins, else the
      // per-intent default. null ⇒ never expires (countdown/finish).
      expiresElapsedMs: (() => {
        const ttl = ttlMs ?? validityTtlMs(intent);
        return ttl != null ? event.elapsedMs + ttl : null;
      })(),
      interrupt: isCritical(intent),
    };
  }

  diagnosticsSnapshot(): CoachDiagnosticsSnapshot {
    return this.diagnostics.snapshot();
  }

  reset(): void {
    this.convo.reset();
    this.queue.reset();
    this.diagnostics.reset();
    this.lastSeq = -1;
  }
}
