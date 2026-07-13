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
import { isCritical, type CoachAction, type CoachIntent, type SpeechSink } from './CoachAction';
import type { CoachContext } from './CoachContext';
import { ConversationState } from './ConversationState';
import { CoachDirector, type DirectedIntent } from './CoachDirector';
import { SpeechPlanner } from './SpeechPlanner';
import { decideSilence } from './SilenceController';
import { priorityFor } from './PriorityResolver';
import { QueueManager } from './QueueManager';
import { CoachDiagnostics, type CoachDiagnosticsSnapshot } from './CoachDiagnostics';
import { personalityFor, type PersonalityProfile } from './personalities';

export class CoachRuntime {
  private readonly convo: ConversationState;
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
    this.convo = new ConversationState(context.config.dedupeWindow);
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
        const dropped = this.queue.flush();
        this.diagnostics.recordDiscarded(dropped.length);
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

    const action = this.buildAction(candidate.intent, text, event, candidate.ttlMs);
    // Commit to conversation memory now so later candidates in this same batch
    // (e.g. teaching after the rest intro) see it and space themselves.
    this.convo.noteSpoken(candidate.intent, text, event.elapsedMs);
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
      expiresElapsedMs: ttlMs != null ? event.elapsedMs + ttlMs : null,
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
