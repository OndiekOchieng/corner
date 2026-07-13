/**
 * SilenceController — the coaching philosophy, made mechanical.
 *
 * Silence is a positive choice (SILENCE_GUIDE.md). This is the gate that keeps
 * the coach from over-talking: it decides, per intent, whether speaking now is
 * warranted, BEFORE any words are chosen. Structural trust lines (intros,
 * countdown, finish) always pass; coaching lines must earn their moment.
 *
 * Pure and deterministic — decisions depend only on the immutable conversation
 * snapshot, the intent, and the engine `elapsedMs`.
 */

import { isStructural, type CoachIntent } from './CoachAction';
import type { CoachConfig } from './CoachContext';
import type { ConversationSnapshot } from './ConversationState';
import type { PersonalityProfile } from './personalities';
import type { PlanParams } from './SpeechPlanner';

export interface SilenceDecision {
  readonly speak: boolean;
  readonly reason: string;
}

const SPEAK = (reason: string): SilenceDecision => ({ speak: true, reason });
const HUSH = (reason: string): SilenceDecision => ({ speak: false, reason });

/**
 * Personality scales the silence gaps: a talkative coach (Fight Night) leaves
 * less air; a quiet one (Calm) leaves more. `talkativeness` 0.25→gap ×1.6,
 * 0.85→gap ×0.8.
 */
function gapScale(profile: PersonalityProfile): number {
  return 1.8 - profile.talkativeness; // 0.25 → 1.55, 0.85 → 0.95
}

export function decideSilence(
  intent: CoachIntent,
  convo: ConversationSnapshot,
  params: PlanParams,
  config: CoachConfig,
  profile: PersonalityProfile,
  nowMs: number,
): SilenceDecision {
  // The trust skeleton is never silenced — the athlete relies on it.
  if (isStructural(intent)) return SPEAK('structural');

  // Density is measured against the last *coaching* line — a structural round
  // intro just before an authored cue must not suppress that cue.
  const sinceLast =
    convo.lastCoachingElapsedMs == null ? Infinity : nowMs - convo.lastCoachingElapsedMs;
  const scale = gapScale(profile);

  switch (intent) {
    case 'correction': {
      // Corrections are important but must not stack on the previous line.
      const minGap = config.minCorrectionGapMs * scale;
      if (sinceLast < minGap) return HUSH('correction too soon after last line');
      return SPEAK('correction due');
    }

    case 'instruction': {
      const minGap = config.minCoachingGapMs * scale;
      if (sinceLast < minGap) return HUSH('instruction inside quiet window');
      return SPEAK('instruction spaced');
    }

    case 'reminder': {
      const minGap = config.minCoachingGapMs * scale;
      if (sinceLast < minGap) return HUSH('reminder inside quiet window');
      // Exact-text reminder dedup handled at planning; here we space them out.
      return SPEAK('reminder spaced');
    }

    case 'urgency': {
      // Earned push, and only with a little air in front of it.
      if (sinceLast < config.minCorrectionGapMs * scale) return HUSH('urgency too soon');
      return SPEAK('urgency due');
    }

    case 'recovery': {
      // Recovery lives in rest; one is enough, spaced from the rest intro.
      if (sinceLast < config.minCorrectionGapMs) return HUSH('recovery too soon after rest intro');
      return SPEAK('recovery due');
    }

    case 'encouragement': {
      // Earned, rare, never on repeat, never right after a correction.
      const sinceEnc =
        convo.lastEncouragementElapsedMs == null
          ? Infinity
          : nowMs - convo.lastEncouragementElapsedMs;
      if (sinceEnc < config.encouragementCooldownMs) return HUSH('encouragement on cooldown');

      const sinceCorrection =
        convo.lastCorrectionElapsedMs == null
          ? Infinity
          : nowMs - convo.lastCorrectionElapsedMs;
      if (sinceCorrection < config.encouragementAfterCorrectionMs) {
        return HUSH('no praise straight after a correction');
      }

      // Personality bias: reticent coaches (low bias) skip more praise. Deterministic
      // by round parity so the same session always makes the same choice.
      if (profile.encouragementBias < 0.5 && convo.currentRound % 2 === 1) {
        return HUSH('reticent coach holds praise this round');
      }
      return SPEAK('earned encouragement');
    }

    case 'teaching': {
      // Teaching belongs in the rest window alongside the rest intro (they play
      // in sequence), so it is NOT gated by the generic gap. It is instead paced
      // by cadence — not every rest — so the coach doesn't lecture every break.
      if (!config.teachingEnabled) return HUSH('teaching disabled');
      if (convo.currentRound % 2 !== 0) return HUSH('teaching cadence — not this rest');
      return SPEAK('teaching window');
    }

    default:
      return SPEAK('default');
  }
}
