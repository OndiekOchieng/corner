/**
 * FlightRecorder — the workout remembers (PR-032).
 *
 * A single, parasitic observer. It owns NOTHING — not time, not sessions, not
 * rounds, not speech. It merely subscribes to what already flows and appends the
 * story of the workout, one honest, temporally-correct line at a time.
 *
 *   Engine → EventBus → (Coach, Media, …) → FlightRecorder.handle() → append()
 *                                            Coach speech → observeSpeech() → append()
 *
 * It is an Event Runtime `Subscriber` like any other, plus a transparent decorator
 * over the coach's `SpeechSink` so the story records what the coach *actually said*,
 * not merely what the workout scheduled. Neither the Engine, the Coach, nor the
 * Media Runtime knows it exists; nothing was added anywhere solely to feed it.
 *
 * It tells STORIES, not STATES: "Round 1 started.", "Coach: Move your feet." — never
 * "spoken=6 discarded=1". Time is the engine's deterministic `elapsedMs`, so the
 * story is reproducible and never touches a wall clock.
 */

import type { WorkoutEvent } from '../engine';
import type { Subscriber } from '../runtime';
import type { SpeechSink } from '../coaching';

/** Coarse category of a moment. The `verbose` kinds are recorded but hidden from the
 *  beautiful athlete story; developer mode (PR-034) shows everything. */
export type StoryKind =
  | 'workout'
  | 'round'
  | 'rest'
  | 'control'
  | 'coach'
  // verbose-only detail — captured for developer investigations, filtered from the story:
  | 'cue'
  | 'countdown'
  | 'speech'
  | 'debug';

/** Kinds recorded but omitted from the beautiful (non-verbose) story. */
const VERBOSE_KINDS: ReadonlySet<StoryKind> = new Set(['cue', 'countdown', 'speech', 'debug']);

/** One remembered moment of the workout. */
export interface StoryMoment {
  /** Engine elapsed time (ms) — deterministic, 0 at the opening bell. */
  readonly atMs: number;
  /** Event sequence at the time of the moment — the tie-breaking sort key. */
  readonly seq: number;
  /** The human line, e.g. "Opening bell. Round 1 started." */
  readonly line: string;
  /** Coarse category, for filtering/rendering. */
  readonly kind: StoryKind;
}

/** Runs first (highest priority) so the current moment is stamped before anyone reacts. */
const FLIGHT_RECORDER_PRIORITY = 1000;
export const FLIGHT_RECORDER_SUBSCRIBER_ID = 'flight-recorder';

/**
 * Render the story line for an engine event, or null for events not worth a line.
 * Structural moments are the athlete's story; `cue`/`countdown`/`debug` are captured
 * as verbose detail for developer investigations (PR-034 — "don't filter").
 */
function narrate(event: WorkoutEvent): { line: string; kind: StoryKind } | null {
  switch (event.type) {
    case 'WORKOUT_STARTED':
      return { line: 'Workout started.', kind: 'workout' };
    case 'WARMUP_STARTED':
      return { line: 'Warm-up started.', kind: 'workout' };
    case 'WARMUP_COMPLETED':
      return { line: 'Warm-up complete.', kind: 'debug' };
    case 'ROUND_STARTED': {
      const n = event.data.roundNumber;
      const name = event.data.round.name;
      const bell = n === 1 ? 'Opening bell.' : 'Bell.';
      return { line: `${bell} Round ${n} started${name ? ` — ${name}` : ''}.`, kind: 'round' };
    }
    case 'ROUND_COMPLETED':
      return { line: `Round ${event.data.roundNumber} completed.`, kind: 'round' };
    case 'REST_STARTED': {
      const next = event.data.nextRound?.name;
      return { line: next ? `Rest. Next up: ${next}.` : 'Rest.', kind: 'rest' };
    }
    case 'REST_COMPLETED':
      return { line: 'Rest complete.', kind: 'debug' };
    case 'COUNTDOWN_STARTED':
      return { line: `Countdown begins (${event.data.context}).`, kind: 'countdown' };
    case 'COUNTDOWN_SECOND':
      return { line: `Countdown: ${event.data.secondsRemaining}.`, kind: 'countdown' };
    case 'COACH_CUE':
      // What the workout SCHEDULED (verbose); observeSpeech records what was SAID.
      return { line: `Cue scheduled: ${event.data.text}`, kind: 'cue' };
    case 'WORKOUT_PAUSED':
      return { line: 'Paused.', kind: 'control' };
    case 'WORKOUT_RESUMED':
      return { line: 'Resumed.', kind: 'control' };
    case 'WORKOUT_COMPLETED':
      return { line: 'Final bell. Workout complete.', kind: 'workout' };
    case 'WORKOUT_CANCELLED':
      return { line: 'Workout ended early.', kind: 'control' };
    default:
      return null;
  }
}

/** Format engine elapsed ms as `m:ss` (or `h:mm:ss` past an hour). */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export class FlightRecorder implements Subscriber {
  readonly id = FLIGHT_RECORDER_SUBSCRIBER_ID;
  readonly priority = FLIGHT_RECORDER_PRIORITY;

  private readonly moments: StoryMoment[] = [];
  /** The moment the last event happened — so observed speech is stamped in-time. */
  private nowMs = 0;
  private nowSeq = 0;

  constructor(private readonly title?: string) {}

  /** Cares about every event — but only *narrates* some (keeps `nowMs` fresh for all). */
  canHandle(): boolean {
    return true;
  }

  handle(event: WorkoutEvent): void {
    // A fresh session (or a StrictMode re-start) begins the story anew.
    if (event.type === 'WORKOUT_STARTED') {
      this.moments.length = 0;
    }
    // Stamp the current moment BEFORE narrating, so coach speech observed during
    // this same event (the recorder runs first) lands at the right time.
    this.nowMs = event.elapsedMs;
    this.nowSeq = event.seq;

    const told = narrate(event);
    if (told) this.append(told.line, told.kind);
  }

  /**
   * Wrap the coach's SpeechSink so the story records what the coach ACTUALLY said,
   * plus (verbose) the speech interruptions the pipeline performs — pause, resume,
   * stop — which is where "speech investigations" live. Every call is delegated
   * unchanged: this observes, it never controls.
   */
  observeSpeech(inner: SpeechSink): SpeechSink {
    return {
      speak: (text: string) => {
        const t = text?.trim();
        if (t) this.append(`Coach: ${t}`, 'coach');
        inner.speak(text);
      },
      pause: () => {
        this.append('Speech paused.', 'speech');
        inner.pause();
      },
      resume: () => {
        this.append('Speech resumed.', 'speech');
        inner.resume();
      },
      cancel: () => {
        this.append('Speech stopped.', 'speech');
        inner.cancel();
      },
      clearPending: () => {
        this.append('Speech queue cleared.', 'speech');
        inner.clearPending();
      },
    };
  }

  private append(line: string, kind: StoryKind): void {
    this.moments.push({ atMs: this.nowMs, seq: this.nowSeq, line, kind });
  }

  /** The remembered moments, in story order (stable: by sequence, then arrival). */
  entries(): readonly StoryMoment[] {
    return this.moments;
  }

  /**
   * The story as markdown. By default the beautiful athlete story (structural +
   * coach voice); `{ verbose: true }` (developer mode, PR-034) hides nothing —
   * cues, countdowns, and speech interruptions included.
   */
  export(opts?: { verbose?: boolean }): string {
    const label = opts?.verbose ? 'Workout Story (verbose)' : 'Workout Story';
    const header = this.title ? `# ${label} — ${this.title}` : `# ${label}`;
    const shown = opts?.verbose ? this.moments : this.moments.filter((m) => !VERBOSE_KINDS.has(m.kind));
    if (shown.length === 0) return `${header}\n\n_(nothing recorded yet)_\n`;
    const lines = shown.map((m) => `- \`${formatElapsed(m.atMs)}\`  ${m.line}`);
    return `${header}\n\n${lines.join('\n')}\n`;
  }

  /** The full, unfiltered story as JSON — every moment, for developer export (PR-034). */
  exportJson(): string {
    return JSON.stringify(
      {
        title: this.title ?? null,
        moments: this.moments.map((m) => ({
          at: formatElapsed(m.atMs),
          atMs: m.atMs,
          seq: m.seq,
          kind: m.kind,
          line: m.line,
        })),
      },
      null,
      2,
    );
  }

  /** Forget everything (e.g. before reusing the recorder). Owns nothing to tear down. */
  reset(): void {
    this.moments.length = 0;
    this.nowMs = 0;
    this.nowSeq = 0;
  }
}
