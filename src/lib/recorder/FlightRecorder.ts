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

/** One remembered moment of the workout. */
export interface StoryMoment {
  /** Engine elapsed time (ms) — deterministic, 0 at the opening bell. */
  readonly atMs: number;
  /** Event sequence at the time of the moment — the tie-breaking sort key. */
  readonly seq: number;
  /** The human line, e.g. "Opening bell. Round 1 started." */
  readonly line: string;
  /** Coarse category, for optional filtering/rendering. */
  readonly kind: 'workout' | 'round' | 'rest' | 'control' | 'coach';
}

/** Runs first (highest priority) so the current moment is stamped before anyone reacts. */
const FLIGHT_RECORDER_PRIORITY = 1000;
export const FLIGHT_RECORDER_SUBSCRIBER_ID = 'flight-recorder';

/** Render the story line for an engine event, or null for events the story omits. */
function narrate(event: WorkoutEvent): { line: string; kind: StoryMoment['kind'] } | null {
  switch (event.type) {
    case 'WORKOUT_STARTED':
      return { line: 'Workout started.', kind: 'workout' };
    case 'WARMUP_STARTED':
      return { line: 'Warm-up started.', kind: 'workout' };
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
    case 'WORKOUT_PAUSED':
      return { line: 'Paused.', kind: 'control' };
    case 'WORKOUT_RESUMED':
      return { line: 'Resumed.', kind: 'control' };
    case 'WORKOUT_COMPLETED':
      return { line: 'Final bell. Workout complete.', kind: 'workout' };
    case 'WORKOUT_CANCELLED':
      return { line: 'Workout ended early.', kind: 'control' };
    // Omitted on purpose — they are noise or captured elsewhere:
    //   WARMUP_COMPLETED / REST_COMPLETED   → the next start line tells the story
    //   COUNTDOWN_STARTED / COUNTDOWN_SECOND → the coach no longer counts (PR-030)
    //   COACH_CUE                            → observeSpeech() records what was SAID
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
   * Wrap the coach's SpeechSink so the story records what the coach ACTUALLY said.
   * Every call is delegated unchanged — this observes, it never controls.
   */
  observeSpeech(inner: SpeechSink): SpeechSink {
    return {
      speak: (text: string) => {
        const t = text?.trim();
        if (t) this.append(`Coach: ${t}`, 'coach');
        inner.speak(text);
      },
      pause: () => inner.pause(),
      resume: () => inner.resume(),
      cancel: () => inner.cancel(),
      clearPending: () => inner.clearPending(),
    };
  }

  private append(line: string, kind: StoryMoment['kind']): void {
    this.moments.push({ atMs: this.nowMs, seq: this.nowSeq, line, kind });
  }

  /** The remembered moments, in story order (stable: by sequence, then arrival). */
  entries(): readonly StoryMoment[] {
    return this.moments;
  }

  /** The story as markdown — human-readable, pasteable, honest. */
  export(): string {
    const header = this.title ? `# Workout Story — ${this.title}` : '# Workout Story';
    if (this.moments.length === 0) return `${header}\n\n_(nothing recorded yet)_\n`;
    const lines = this.moments.map((m) => `- \`${formatElapsed(m.atMs)}\`  ${m.line}`);
    return `${header}\n\n${lines.join('\n')}\n`;
  }

  /** Forget everything (e.g. before reusing the recorder). Owns nothing to tear down. */
  reset(): void {
    this.moments.length = 0;
    this.nowMs = 0;
    this.nowSeq = 0;
  }
}
