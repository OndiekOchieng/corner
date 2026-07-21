/**
 * Developer Workout Story (PR / spec: developer-workout-stories) — DEV ONLY.
 *
 * After a workout finishes, a developer should be able to answer *"what happened?"*
 * instead of saying *"no idea."* This is the post-workout **outcome digest** — a short
 * per-subsystem verdict (speech, coach, wake lock, visibility, bell) plus the full
 * Flight Recorder story — captured at the moment the workout completes.
 *
 * It is a *projection* of things that already exist (the Flight Recorder story + the
 * media/coach/speech diagnostics) — no new runtime, manager, or service, and it owns
 * nothing. `summarizeWorkout` is a pure function; the holder is a single in-memory
 * handoff that survives one client-side navigation to the Finish page.
 *
 * V1 is allowed to FORGET: no persistence. A refresh loses the story, on purpose.
 */

import type { CoachDiagnosticsSnapshot } from '../coaching';
import type { MediaDiagnosticsSnapshot, SpeechServiceStats } from '../media';

/** One line of the digest — a subsystem's verdict. */
export interface DevStoryVerdict {
  readonly label: string;
  readonly status: 'ok' | 'warn' | 'off';
  readonly detail: string;
}

/** The captured story: a digest + the full narrative, for the Finish-page dev panel. */
export interface DevWorkoutStory {
  readonly title: string;
  readonly verdicts: readonly DevStoryVerdict[];
  readonly storyMarkdown: string;
  readonly storyJson: string;
}

/** The raw material — all already produced elsewhere; this only reads it. */
export interface DevStoryInputs {
  readonly title: string;
  readonly storyMarkdown: string;
  readonly storyJson: string;
  readonly coach: CoachDiagnosticsSnapshot | null;
  readonly media: MediaDiagnosticsSnapshot | null;
  readonly speech: SpeechServiceStats | null;
}

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`;
}
function fmtMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Turn the session's diagnostics into a short verdict per subsystem. Pure and
 * deterministic — the digest is a read of what already happened, never a re-run.
 */
export function summarizeWorkout(i: DevStoryInputs): DevStoryVerdict[] {
  const v: DevStoryVerdict[] = [];

  // Speech — did what reached the browser actually start? (onstart is "heard".)
  if (i.speech) {
    const { synthSpeakCalls, started, errors } = i.speech;
    const unheard = Math.max(0, synthSpeakCalls - started - errors);
    // Allow one in-flight utterance (the closing line may still be starting at finish).
    const ok = errors === 0 && unheard <= 1;
    v.push({
      label: 'Speech',
      status: ok ? 'ok' : 'warn',
      detail: `${started}/${synthSpeakCalls} started · ${plural(errors, 'error')}${unheard > 0 ? ` · ${unheard} unheard` : ''}`,
    });
  } else {
    v.push({ label: 'Speech', status: 'off', detail: 'not available' });
  }

  // Coach — how much did it decide to say, and did it get out?
  if (i.coach) {
    const { actionsGenerated, actionsSpoken, actionsDiscarded } = i.coach;
    const ok = actionsGenerated === 0 || actionsSpoken > 0;
    v.push({
      label: 'Coach',
      status: ok ? 'ok' : 'warn',
      detail: `${actionsSpoken}/${actionsGenerated} spoken · ${actionsDiscarded} discarded`,
    });
  }

  // Wake lock + visibility — did the screen stay awake, and how often did we leave?
  if (i.media) {
    const m = i.media;
    if (!m.wakeLockSupported) {
      v.push({ label: 'Wake lock', status: 'off', detail: 'unsupported (platform)' });
    } else {
      const recovered = m.wakeLockReacquired >= m.wakeLockReleased;
      const ok = m.wakeLockReleased === 0 || recovered;
      const held =
        m.wakeLockReleased === 0
          ? 'held throughout'
          : `held ${m.wakeLockHeldDurationMs != null ? fmtMs(m.wakeLockHeldDurationMs) : m.wakeLockStatus}`;
      v.push({
        label: 'Wake lock',
        status: ok ? 'ok' : 'warn',
        detail: `${held} · ${plural(m.wakeLockReleased, 'release')} · ${plural(m.wakeLockReacquired, 'reacquire')}`,
      });
    }
    // Visibility interruptions ≈ returns-to-visible while a lock was wanted (a proxy;
    // there is no dedicated counter, and this is honestly labelled).
    v.push({
      label: 'Visibility',
      status: 'ok',
      detail: m.wakeLockSupported ? plural(m.wakeLockReacquired, 'interruption') : 'not tracked',
    });
  }

  // Bell — the transitions where it rings are recorded in the story.
  const bells = (i.storyMarkdown.match(/bell/gi) ?? []).length;
  v.push({ label: 'Bell', status: bells > 0 ? 'ok' : 'off', detail: bells > 0 ? `${plural(bells, 'ring')}` : 'none' });

  return v;
}

/** Assemble a captured story from the raw inputs (digest + full narrative). */
export function buildDevWorkoutStory(i: DevStoryInputs): DevWorkoutStory {
  return {
    title: i.title,
    verdicts: summarizeWorkout(i),
    storyMarkdown: i.storyMarkdown,
    storyJson: i.storyJson,
  };
}

// --- In-memory handoff (no persistence) --------------------------------------
// A single dev-only slot that survives the client navigation /active → /finish.
// It is deliberately forgotten on a full refresh — V1 is allowed to forget.

let held: DevWorkoutStory | null = null;

/** Capture the story at workout completion (dev-only caller). */
export function captureDevWorkoutStory(inputs: DevStoryInputs): void {
  held = buildDevWorkoutStory(inputs);
}

/** Read the last captured story (the Finish-page dev panel). Null after a refresh. */
export function getDevWorkoutStory(): DevWorkoutStory | null {
  return held;
}
