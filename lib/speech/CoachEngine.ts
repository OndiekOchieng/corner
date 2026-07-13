/**
 * CoachEngine
 * -------------------------------------------------------------------------
 * Translates *workout events* into *spoken phrases*. It sits between the
 * WorkoutEngine and the SpeechService:
 *
 *   WorkoutEngine -> CoachEngine -> SpeechService -> Browser Speech API
 *
 * The CoachEngine knows nothing about React or the browser Speech API — it only
 * calls `SpeechService.speak()`. It is deliberately IDEMPOTENT: every announce
 * method is guarded so that being called repeatedly (which React effects will
 * do, tick after tick) never produces a duplicate announcement. This is what
 * makes the coaching flow deterministic without depending on a perfectly
 * behaved timer upstream.
 */

import { Round, Workout } from '@/types/workout';
import { SpeechService } from './SpeechService';
import { capitalize, humanizeName, numberToWords } from './phrases';

/** Seconds-remaining thresholds that trigger a spoken countdown. */
export const COUNTDOWN_SECONDS = [10, 5, 4, 3, 2, 1] as const;

export class CoachEngine {
  private readonly speech: SpeechService;

  // Idempotency state ---------------------------------------------------------
  private startAnnounced = false;
  private warmupAnnounced = false;
  private completed = false;
  private currentRoundKey = '';
  private restAnnouncedForRound = new Set<number>();
  private spokenCueIds = new Set<string>();
  private spokenCountdownSeconds = new Set<number>();

  constructor(speech: SpeechService) {
    this.speech = speech;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle events
  // ---------------------------------------------------------------------------

  /** "Starting workout." + the workout's name. Fires once per session. */
  announceWorkoutStart(workout: Pick<Workout, 'name'>): void {
    if (this.startAnnounced) return;
    this.startAnnounced = true;

    this.speech.speak('Starting workout.');
    if (workout?.name) {
      this.speech.speak(`Today's workout. ${humanizeName(workout.name)}.`);
    }
  }

  /** "Warm up." Fires once per session. */
  announceWarmup(): void {
    if (this.warmupAnnounced) return;
    this.warmupAnnounced = true;
    this.speech.speak('Warm up.');
  }

  /**
   * Announce the start of a round: "Round One.", the round name, then the drill.
   * Idempotent per round number — safe to call every render while the round is
   * active. Entering a new round resets cue/countdown de-dup state.
   */
  announceRound(round: Round, roundNumber: number): void {
    const key = `round-${roundNumber}`;
    if (key === this.currentRoundKey) return;
    this.currentRoundKey = key;
    this.spokenCueIds.clear();
    this.spokenCountdownSeconds.clear();

    this.speech.speak(`Round ${capitalize(numberToWords(roundNumber))}.`);
    if (round?.name) this.speech.speak(humanizeName(round.name));

    const drill = round?.currentDrill?.trim() || round?.currentCue?.text?.trim();
    if (drill) this.speech.speak(drill);
  }

  /**
   * Speak any coaching cues whose scheduled time has arrived. Each cue is spoken
   * exactly once per round (keyed by round number + cue id).
   */
  handleCues(round: Round, roundNumber: number, elapsedSeconds: number): void {
    if (!round?.coachingCues?.length) return;

    for (const cue of round.coachingCues) {
      const cueId = `round-${roundNumber}-cue-${cue.id}`;
      if (this.spokenCueIds.has(cueId)) continue;

      const dueAt = cue.timeSeconds ?? 0;
      if (elapsedSeconds >= dueAt) {
        this.spokenCueIds.add(cueId);
        if (cue.text?.trim()) this.speech.speak(cue.text);
      }
    }
  }

  /**
   * Speak the end-of-phase countdown ("Ten seconds.", "Five.", ... "One.").
   * Each threshold is spoken at most once per round.
   */
  handleCountdown(secondsRemaining: number): void {
    for (const threshold of COUNTDOWN_SECONDS) {
      if (secondsRemaining !== threshold) continue;
      if (this.spokenCountdownSeconds.has(threshold)) continue;
      this.spokenCountdownSeconds.add(threshold);
      this.speech.speak(
        threshold === 10 ? 'Ten seconds.' : `${capitalize(numberToWords(threshold))}.`
      );
    }
  }

  /**
   * Announce a rest period between rounds. Idempotent per finishing-round number.
   * `nextRoundName` is optional; when present it is appended ("Next round. Foo.").
   */
  announceRest(finishingRoundNumber: number, nextRoundName?: string): void {
    if (this.restAnnouncedForRound.has(finishingRoundNumber)) return;
    this.restAnnouncedForRound.add(finishingRoundNumber);

    this.speech.speak('Rest.');
    this.speech.speak('Breathe.');
    if (nextRoundName?.trim()) {
      this.speech.speak(`Next round. ${humanizeName(nextRoundName)}.`);
    } else {
      this.speech.speak('Next round.');
    }
  }

  /** Final completion announcement. Fires once per session. */
  announceComplete(totalRounds: number): void {
    if (this.completed) return;
    this.completed = true;

    this.speech.speak('Workout complete.');
    this.speech.speak('Excellent work.');
    if (totalRounds > 0) {
      this.speech.speak(`You completed ${numberToWords(totalRounds)} rounds.`);
    }
  }

  /**
   * Speak an already-resolved phrase directly.
   *
   * Additive helper for event-driven callers (PR-004b CoachSubscriber): the
   * Execution Engine now schedules and de-duplicates cues/countdowns itself, so
   * the runtime passes resolved text/wording straight through here instead of
   * using the polling `handleCues`/`handleCountdown` methods (which carry their
   * own per-round dedup designed for the old tick-polling model).
   */
  say(text: string): void {
    this.speech.speak(text);
  }

  // ---------------------------------------------------------------------------
  // Playback control
  // ---------------------------------------------------------------------------

  pause(): void {
    this.speech.pause();
  }

  resume(): void {
    this.speech.resume();
  }

  /**
   * Stop coaching entirely: cancel speech, drop the queue, and forget all
   * idempotency state so a fresh workout starts clean. Used by Quit.
   */
  reset(): void {
    this.speech.cancel();
    this.startAnnounced = false;
    this.warmupAnnounced = false;
    this.completed = false;
    this.currentRoundKey = '';
    this.restAnnouncedForRound.clear();
    this.spokenCueIds.clear();
    this.spokenCountdownSeconds.clear();
  }
}
