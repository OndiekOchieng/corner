/**
 * workout-config — maps the app's `Workout` (seconds, UI-shaped) into the
 * engine's `WorkoutConfig` (integer ms, engine-shaped). This is the single place
 * the two models meet; the engine never depends on the app type.
 *
 * Cue timing is normalised to be strictly increasing and inside the round
 * (0 < atMs < workMs) so the engine's Timeline never rejects it. The app has no
 * warmup concept, so `warmupMs` is 0 (no warmup segment is emitted).
 *
 * Time anchors (Layer 2 coaching) are authored CONTENT, not runtime logic. This
 * mapper injects sensible defaults ("two minutes", "one minute", "thirty seconds")
 * for rounds long enough to warrant them, unless the author already placed them —
 * so every workout gets time-awareness while the engine still does the scheduling.
 */

import type { Workout, CoachingCue } from '@/types/workout';
import type { WorkoutConfig, RoundConfig, CueConfig } from '@/src/types/workout-config';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

interface Intended {
  id: string;
  text: string;
  atMs: number;
}

/** Default anchors, injected for rounds long enough (by remaining time). */
const ANCHOR_PLAN: ReadonlyArray<{
  readonly id: string;
  readonly text: string;
  readonly remainingMs: number;
  readonly minWorkMs: number;
}> = [
  { id: 'anchor-twomin', text: 'Two minutes to go.', remainingMs: 120_000, minWorkMs: 165_000 },
  { id: 'anchor-onemin', text: 'One minute to go.', remainingMs: 60_000, minWorkMs: 90_000 },
  { id: 'anchor-thirty', text: 'Thirty seconds.', remainingMs: 30_000, minWorkMs: 55_000 },
];

/** Fallback placement for a cue that only carries a coarse `timing`. */
function timingToMs(timing: CoachingCue['timing'], workMs: number): number {
  switch (timing) {
    case 'start':
      return Math.min(3000, Math.round(workMs * 0.15));
    case 'end':
      return Math.round(workMs * 0.8);
    case 'middle':
    default:
      return Math.round(workMs * 0.5);
  }
}

function authoredCues(cues: readonly CoachingCue[], workMs: number): Intended[] {
  if (workMs <= 1000) return [];
  return cues
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (c.text ?? '').trim().length > 0)
    .map(({ c, i }) => {
      const at =
        typeof c.timeSeconds === 'number'
          ? Math.round(c.timeSeconds * 1000)
          : timingToMs(c.timing, workMs);
      return { id: (c.id ?? '').trim() || `cue-${i}`, text: c.text.trim(), atMs: clamp(at, 1, workMs - 1) };
    });
}

/** Injected anchors that fit the round and don't clash with authored content. */
function anchorCues(workMs: number, authored: readonly Intended[]): Intended[] {
  const authoredIds = new Set(authored.map((c) => c.id));
  const out: Intended[] = [];
  for (const a of ANCHOR_PLAN) {
    if (workMs < a.minWorkMs) continue;
    if (authoredIds.has(a.id)) continue; // author already placed this anchor
    const atMs = workMs - a.remainingMs;
    if (atMs < 8000 || atMs > workMs - 12000) continue; // too early / clashes with the countdown
    const clash =
      authored.some((c) => Math.abs(c.atMs - atMs) < 5000) ||
      out.some((c) => Math.abs(c.atMs - atMs) < 5000);
    if (clash) continue;
    out.push({ id: a.id, text: a.text, atMs });
  }
  return out;
}

/** Sort + enforce strictly-increasing, in-range times and unique ids. */
function normalize(entries: Intended[], workMs: number): CueConfig[] {
  const sorted = [...entries].sort((a, b) => a.atMs - b.atMs);
  const out: CueConfig[] = [];
  const seen = new Set<string>();
  let prev = 0;
  for (const cue of sorted) {
    const atMs = Math.max(cue.atMs, prev + 1);
    if (atMs >= workMs) break; // no room left in the round
    let id = cue.id;
    let k = 1;
    while (seen.has(id)) id = `${cue.id}-${k++}`;
    seen.add(id);
    out.push({ id, text: cue.text, atMs });
    prev = atMs;
  }
  return out;
}

function toCues(cues: readonly CoachingCue[], workMs: number): CueConfig[] {
  const authored = authoredCues(cues, workMs);
  const anchors = anchorCues(workMs, authored);
  return normalize([...authored, ...anchors], workMs);
}

export function toWorkoutConfig(workout: Workout): WorkoutConfig {
  const rounds: RoundConfig[] = workout.rounds.map((r, i) => {
    const workMs = Math.max(1000, Math.round(r.drillDuration * 1000));
    return {
      id: (r.id ?? '').trim() || `round-${i}`,
      name: r.name,
      workMs,
      restMs: Math.max(0, Math.round(r.restDuration * 1000)),
      cues: toCues(r.coachingCues ?? [], workMs),
    };
  });

  return {
    schemaVersion: 1,
    workoutId: workout.id,
    warmupMs: 0,
    rounds,
  };
}
