import { describe, it, expect } from 'vitest';
import { CoachRuntime, QueueManager, makeContext, type CoachAction } from '../../lib/coaching';
import { SpySink, evt } from './helpers';

type EvtArgs = Parameters<typeof evt>;

/** Drive a session with optional pause/resume and a post-resume cue. Long round so
 *  mid-round cues are never near the countdown. */
function session(opts: { resumeAtMs?: number; cueAfterResumeAt?: number } = {}) {
  const sink = new SpySink();
  const rt = new CoachRuntime(makeContext('technical', { workoutName: 'W' }), sink);
  let seq = 1;
  const push = (type: EvtArgs[0], elapsed: number, data: unknown) =>
    rt.onEvent(evt(type, seq++, elapsed, data as never));

  push('WORKOUT_STARTED', 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 180000, hasWarmup: false });
  push('ROUND_STARTED', 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Jab', workMs: 180000, restMs: 0, cues: [] }, durationMs: 180000 });
  if (opts.resumeAtMs != null) {
    push('WORKOUT_PAUSED', opts.resumeAtMs, { phase: 'round', elapsedMs: opts.resumeAtMs });
    push('WORKOUT_RESUMED', opts.resumeAtMs, { phase: 'round', elapsedMs: opts.resumeAtMs, pausedForMs: 0 });
  }
  if (opts.cueAfterResumeAt != null) {
    push('COACH_CUE', opts.cueAfterResumeAt, { roundIndex: 0, cueId: 'c-after', text: 'Keep your hands high', atMs: opts.cueAfterResumeAt });
  }
  return sink;
}

describe('Temporal consistency (PR-021)', () => {
  it('the coach never announces round one — the BELL owns that transition (PR-030)', () => {
    const spoken = session().spoken;
    // The opening line is the intro; it must not announce the round.
    expect(spoken[0].toLowerCase()).not.toMatch(/round\s*(one|1)\b/);
    // No coach line announces round one at all — presence, not a second announcement.
    // The round-start bell (Media Runtime) is what says "we're boxing now".
    const roundAnnouncements = spoken.filter((l) => /round\s*(one|1)\b/i.test(l));
    expect(roundAnnouncements).toHaveLength(0);
  });

  it('resume never replays the introduction (5 s / 45 s / 90 s)', () => {
    for (const at of [5000, 45000, 90000]) {
      const sink = session({ resumeAtMs: at });
      // The intro was spoken once, before the pause, and is NOT replayed on resume.
      expect(sink.spoken.filter((l) => /let's build/i.test(l))).toHaveLength(1);
      // On resume the coach drops stale buffered speech, then un-pauses.
      expect(sink.calls).toContain('pause');
      const resumeIdx = sink.calls.lastIndexOf('resume');
      expect(sink.calls.slice(0, resumeIdx)).toContain('cancel'); // stale dropped before resume
    }
  });

  it('resume output is identical regardless of when the athlete resumed (determinism)', () => {
    expect(session({ resumeAtMs: 5000 }).spoken).toEqual(session({ resumeAtMs: 45000 }).spoken);
    expect(session({ resumeAtMs: 45000 }).spoken).toEqual(session({ resumeAtMs: 90000 }).spoken);
  });

  it('after a mid-round resume the coach coaches the CURRENT moment', () => {
    const sink = session({ resumeAtMs: 45000, cueAfterResumeAt: 60000 });
    expect(sink.spoken).toContain('Keep your hands high'); // current cue is heard
  });

  it('pause/resume is fully deterministic', () => {
    const a = session({ resumeAtMs: 45000, cueAfterResumeAt: 60000 });
    const b = session({ resumeAtMs: 45000, cueAfterResumeAt: 60000 });
    expect(a.spoken).toEqual(b.spoken);
    expect(a.calls).toEqual(b.calls);
  });
});

// --- Validity window (queue expiry) -----------------------------------------

function action(over: Partial<CoachAction>): CoachAction {
  return {
    id: 'a',
    intent: 'instruction',
    priority: 44,
    text: 'X',
    sourceSeq: 1,
    createdElapsedMs: 0,
    expiresElapsedMs: null,
    interrupt: false,
    ...over,
  };
}

describe('Temporal validity — the queue is future coaching, not history (PR-021)', () => {
  it('discards expired coaching and preserves still-valid coaching', () => {
    const q = new QueueManager(8);
    const sink = new SpySink();
    q.enqueue(action({ id: 's', text: 'stale', expiresElapsedMs: 5000 }));
    q.enqueue(action({ id: 'f', intent: 'reminder', text: 'fresh', expiresElapsedMs: 20000 }));

    const r = q.drain(sink, 8000); // now is past 'stale' but within 'fresh'

    expect(sink.spoken).toContain('fresh'); // still valid → spoken
    expect(sink.spoken).not.toContain('stale'); // expired → discarded
    expect(r.expired.map((a) => a.text)).toContain('stale');
  });
});

// --- Structural-deadline preemption -----------------------------------------

describe('Countdown preemption (PR-021)', () => {
  /** A 60 s round; the 10 s countdown beat lands at elapsed 50 000. */
  function preemptSession() {
    const sink = new SpySink();
    const rt = new CoachRuntime(makeContext('technical', { workoutName: 'W' }), sink);
    let seq = 1;
    const push = (type: EvtArgs[0], elapsed: number, data: unknown) =>
      rt.onEvent(evt(type, seq++, elapsed, data as never));
    push('WORKOUT_STARTED', 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 60000, hasWarmup: false });
    push('ROUND_STARTED', 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Jab', workMs: 60000, restMs: 0, cues: [] }, durationMs: 60000 });
    // Comfortably mid-round: finishes long before any beat → spoken.
    push('COACH_CUE', 30000, { roundIndex: 0, cueId: 'mid', text: 'Keep your hands high', atMs: 30000 });
    // Right before the 10 s beat (50 000): cannot finish in time → skipped.
    push('COACH_CUE', 49500, { roundIndex: 0, cueId: 'late', text: 'Stay on your feet', atMs: 49500 });
    return sink;
  }

  it('speaks coaching that fits before the next beat, skips coaching that would be cut', () => {
    const spoken = preemptSession().spoken;
    expect(spoken).toContain('Keep your hands high'); // fits → spoken
    expect(spoken).not.toContain('Stay on your feet'); // would collide with the count → skipped
  });

  it('never begins late coaching that would be interrupted (deterministic)', () => {
    expect(preemptSession().spoken).toEqual(preemptSession().spoken);
  });

  // PR-022 — the coach derives its beats from the workout's engine config, not a
  // duplicated constant. A cue at 49 500 in a 60 s round collides with the default
  // 10 s beat (@50 000), but not with a config whose largest beat is 6 s (@54 000).
  it('derives countdown beats from engine config (custom thresholds honoured)', () => {
    const runWithLeads = (leads?: number[]) => {
      const sink = new SpySink();
      const rt = new CoachRuntime(
        makeContext('technical', { workoutName: 'W', countdownLeadSeconds: leads }),
        sink,
      );
      let seq = 1;
      const push = (type: EvtArgs[0], elapsed: number, data: unknown) =>
        rt.onEvent(evt(type, seq++, elapsed, data as never));
      push('WORKOUT_STARTED', 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 60000, hasWarmup: false });
      push('ROUND_STARTED', 0, { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'Jab', workMs: 60000, restMs: 0, cues: [] }, durationMs: 60000 });
      push('COACH_CUE', 49500, { roundIndex: 0, cueId: 'late', text: 'Stay on your feet', atMs: 49500 });
      return sink.spoken;
    };

    // Engine default beats include a 10 s beat (@50 000) → the cue collides → skipped.
    expect(runWithLeads(undefined)).not.toContain('Stay on your feet');
    // A config whose earliest beat is 6 s (@54 000) leaves room → the cue is spoken.
    expect(runWithLeads([6, 3, 1])).toContain('Stay on your feet');
    // Unsorted config is normalised to descending and behaves identically.
    expect(runWithLeads([1, 3, 6])).toContain('Stay on your feet');
  });
});
