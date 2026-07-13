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
import type { ConversationState } from './ConversationState';
import type { PlanParams } from './SpeechPlanner';
import { parseAnchorKind } from './anchors';
import { classifyDimension } from './reinforcements';

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

  direct(event: WorkoutEvent, convo: ConversationState): DirectedIntent[] {
    switch (event.type) {
      case 'WORKOUT_STARTED': {
        convo.setTotalRounds(event.data.totalRounds);
        convo.setEnergy('calm');
        return [
          {
            intent: 'workout_intro',
            params: {
              workoutName: this.context.workoutName ?? event.data.workoutId,
              totalRounds: event.data.totalRounds,
            },
          },
        ];
      }

      case 'WARMUP_STARTED':
        convo.setEnergy('calm');
        return [{ intent: 'warmup', params: {} }];

      case 'ROUND_STARTED': {
        convo.enterRound(event.data.roundNumber);
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
        return [{ intent: 'encouragement', params: { roundNumber: event.data.roundNumber } }];

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
        convo.setEnergy('peak');
        return [
          {
            intent: 'countdown',
            params: { secondsRemaining: event.data.secondsRemaining },
          },
        ];

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
