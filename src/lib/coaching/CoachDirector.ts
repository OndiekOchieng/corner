/**
 * CoachDirector — engine event → candidate coaching intent(s).
 *
 * This is where "should the coach react, and as what?" is answered. It maps each
 * immutable event to zero or more candidate intents and their parameters, and
 * updates the lightweight conversation context (which round, what energy). It
 * does NOT decide whether the line is actually spoken (SilenceController) or what
 * words it uses (SpeechPlanner) — only the coaching *shape* of the reaction.
 *
 * Control events (pause/resume/cancel) are handled by the runtime directly (they
 * operate the sink, not produce speech) and are intentionally ignored here.
 */

import type { WorkoutEvent } from '../engine';
import type { CoachIntent } from './CoachAction';
import type { CoachContext } from './CoachContext';
import type { CoachingMemory } from './CoachingMemory';
import type { PlanParams } from './SpeechPlanner';
import { parseAnchorKind } from './anchors';
import { classifyDimension } from './reinforcements';
import { personalityFor } from './personalities';

export interface DirectedIntent {
  readonly intent: CoachIntent;
  readonly params: PlanParams;
  /** Time-to-live in ms from the event's elapsed; omitted = no expiry. */
  readonly ttlMs?: number;
}

const REMINDER_WORDS = ['hand', 'chin', 'guard', 'breathe', 'breath', 'relax', 'loose'];
const CORRECTION_MARKERS = ["don't", 'dont', 'not ', 'no ', 'stop', 'tighter', 'same line', 'never'];

/** Classify an authored cue into a coaching pattern (CONVERSATION_PATTERNS.md). */
export function classifyCue(text: string): CoachIntent {
  const t = text.toLowerCase();
  if (CORRECTION_MARKERS.some((m) => t.includes(m))) return 'correction';
  if (REMINDER_WORDS.some((w) => t.includes(w))) return 'reminder';
  return 'instruction';
}

export class CoachDirector {
  constructor(private readonly context: CoachContext) {}

  direct(event: WorkoutEvent, convo: CoachingMemory): DirectedIntent[] {
    switch (event.type) {
      case 'WORKOUT_STARTED': {
        convo.setTotalRounds(event.data.totalRounds);
        // The session opens at the energy the Coach Pack's introduction declares.
        convo.setEnergy(personalityFor(this.context.personality).introduction.energy);
        const { facts } = this.context;
        return [
          {
            intent: 'workout_intro',
            params: {
              workoutName: this.context.workoutName ?? event.data.workoutId,
              totalRounds: event.data.totalRounds,
              // Workout facts the Coach Pack frames in its opening.
              focus: facts.focus,
              objective: facts.objective,
              timeOfDay: facts.timeOfDay,
            },
          },
        ];
      }

      case 'WARMUP_STARTED':
        convo.setEnergy('calm');
        return [{ intent: 'warmup', params: {} }];

      case 'ROUND_STARTED': {
        convo.enterRound(event.data.roundNumber);
        // Record when this round ends so coaching respects the countdown (PR-021).
        convo.setRoundEnd(event.elapsedMs + event.data.durationMs);
        // PR-030 — the BELL announces the round; the coach does not number the FIRST
        // one. The opening intro already greeted the athlete, so round one is:
        // intro → (room) → DING → box — presence, not a second announcement (the
        // bell owns transitions). Later rounds keep a brief intro for orientation and
        // final-round framing, which a single bell can't convey.
        if (event.data.roundNumber <= 1) return [];
        const roundName = event.data.round.name ?? `Round ${event.data.roundNumber}`;
        return [
          {
            intent: 'round_intro',
            params: {
              roundNumber: event.data.roundNumber,
              roundName,
              isFinalRound: convo.isFinalRound(),
              totalRounds: convo.snapshot().totalRounds,
            },
          },
        ];
      }

      case 'COACH_CUE': {
        convo.setEnergy('steady');
        const roundNumber = event.data.roundIndex + 1;

        // Semantic combination cue (PR-020D) — recognised by the authored cue id,
        // not by parsing the text. The pack renders it via the Boxing Lexicon.
        const combination = this.context.combinations.get(event.data.cueId);
        if (combination && combination.length > 0) {
          return [{ intent: 'combination', params: { combination, roundNumber } }];
        }

        // Layer 2 — an authored (or injected) time anchor.
        const anchorKind = parseAnchorKind(event.data.cueId);
        if (anchorKind) {
          return [{ intent: 'time_anchor', params: { anchorKind } }];
        }

        // Layer 3 — reinforce instead of repeating the same lesson within a round.
        const dimension = classifyDimension(event.data.text);
        if (convo.wasDimensionTaughtThisRound(dimension)) {
          return [{ intent: 'reinforcement', params: { dimension, roundNumber } }];
        }

        // First time this dimension is taught this round — speak it as authored.
        return [
          {
            intent: classifyCue(event.data.text),
            params: { cueText: event.data.text, dimension, roundNumber },
          },
        ];
      }

      case 'ROUND_COMPLETED':
        // Candidate earned encouragement — the silence gate decides if it's earned.
        // Reference the lesson taught so praise reinforces a concept ("Good. Keep
        // protecting yourself.") instead of a hollow "Great job".
        return [
          {
            intent: 'encouragement',
            params: {
              roundNumber: event.data.roundNumber,
              dimension: convo.lastTaughtDimension() ?? undefined,
            },
          },
        ];

      case 'REST_STARTED': {
        convo.setEnergy('low');
        const next = event.data.nextRound.name ?? '';
        return [
          { intent: 'rest_intro', params: { nextRoundName: next } },
          { intent: 'teaching', params: {} },
        ];
      }

      case 'COUNTDOWN_STARTED': {
        // Clear the air before the numbers, unless it's the final round — then a
        // short earned push that will be cut by the count if it can't land in time.
        if (event.data.context === 'round') convo.setEnergy('rising');
        if (event.data.context === 'round' && convo.isFinalRound()) {
          return [{ intent: 'urgency', params: {}, ttlMs: this.context.config.urgencyTtlMs }];
        }
        return [];
      }

      case 'COUNTDOWN_SECOND':
        // PR-030 — the coach no longer counts. "Ten… five… four…" is a software-ism:
        // it announces that a machine is timing the athlete. The engine's countdown
        // markers stay exactly as intelligent as today (the coach still uses them to
        // avoid STARTING a line the boundary would cut — PR-021 preemption), but the
        // numbers are never spoken. Silence holds the air; the BELL marks the
        // transition. Software counts; a gym rings.
        return [];

      case 'WORKOUT_COMPLETED':
        convo.setEnergy('low');
        return [{ intent: 'finish', params: { totalRounds: event.data.plannedRounds } }];

      // Structural bookends with nothing to say, and control events (handled by
      // the runtime), produce no coaching line.
      case 'WARMUP_COMPLETED':
      case 'REST_COMPLETED':
      case 'WORKOUT_PAUSED':
      case 'WORKOUT_RESUMED':
      case 'WORKOUT_CANCELLED':
      default:
        return [];
    }
  }
}
