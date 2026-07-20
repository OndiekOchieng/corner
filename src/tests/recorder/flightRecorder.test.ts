import { describe, it, expect } from 'vitest';
import { FlightRecorder } from '../../lib/recorder';
import type { WorkoutEvent } from '../../lib/engine';

/** Minimal event builder — the recorder only reads type/seq/elapsedMs/data. */
function ev(type: string, seq: number, elapsedMs: number, data: unknown): WorkoutEvent {
  return { type, at: elapsedMs, elapsedMs, seq, data } as unknown as WorkoutEvent;
}
function round(n: number, name: string, durMs = 180000) {
  return { roundIndex: n - 1, roundNumber: n, round: { id: `r${n}`, name, workMs: durMs, restMs: 0, cues: [] }, durationMs: durMs };
}

describe('FlightRecorder (PR-032)', () => {
  it("tells the story of a workout — structure plus the coach's actual voice", () => {
    const rec = new FlightRecorder('Foundations');
    const heard: string[] = [];
    // The recorder decorates the coach's sink; the coach still speaks into `heard`.
    const sink = rec.observeSpeech({
      speak: (t) => heard.push(t),
      pause: () => {},
      resume: () => {},
      cancel: () => {},
      clearPending: () => {},
    });

    // Mirror the real bus order: recorder handles the event (stamping the moment)
    // BEFORE the coach reacts and speaks.
    rec.handle(ev('WORKOUT_STARTED', 1, 0, { workoutId: 'w', totalRounds: 2, plannedDurationMs: 600000, hasWarmup: false }));
    sink.speak("Alright. Foundations. Let's work."); // coach intro at t=0
    rec.handle(ev('ROUND_STARTED', 2, 0, round(1, 'Jab')));
    rec.handle(ev('COACH_CUE', 3, 10000, { roundIndex: 0, cueId: 'c1', text: 'Move your feet', atMs: 10000 }));
    sink.speak('Move your feet.'); // what the coach actually said
    rec.handle(ev('ROUND_COMPLETED', 4, 180000, { roundIndex: 0, roundNumber: 1 }));
    rec.handle(ev('REST_STARTED', 5, 180000, { durationMs: 60000, nextRoundIndex: 1, nextRound: { id: 'r2', name: 'Cross', workMs: 180000, restMs: 0, cues: [] } }));
    rec.handle(ev('ROUND_STARTED', 6, 240000, round(2, 'Cross')));
    rec.handle(ev('WORKOUT_COMPLETED', 7, 420000, { plannedRounds: 2 }));

    const story = rec.export();

    // The workout's shape, in order…
    expect(story).toContain('Workout started.');
    expect(story).toContain('Opening bell. Round 1 started — Jab.');
    expect(story).toContain('Round 1 completed.');
    expect(story).toContain('Rest. Next up: Cross.');
    expect(story).toContain('Bell. Round 2 started — Cross.');
    expect(story).toContain('Final bell. Workout complete.');
    // …the coach's real voice…
    expect(story).toContain("Coach: Alright. Foundations. Let's work.");
    expect(story).toContain('Coach: Move your feet.');
    // …stamped with the engine's deterministic elapsed time…
    expect(story).toContain('`0:10`  Coach: Move your feet.'); // 10 000 ms
    expect(story).toContain('`3:00`  Round 1 completed.'); // 180 000 ms
    // …and the title.
    expect(story).toContain('# Workout Story — Foundations');

    // Parasitic: the inner sink received every line, unchanged.
    expect(heard).toEqual(["Alright. Foundations. Let's work.", 'Move your feet.']);

    // The moments are ordered by when they happened (by sequence).
    const seqs = rec.entries().map((m) => m.seq);
    expect([...seqs]).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('filters noise from the beautiful story but keeps EVERYTHING for developers (PR-034)', () => {
    const rec = new FlightRecorder();
    rec.handle(ev('WORKOUT_STARTED', 1, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 1000, hasWarmup: false }));
    rec.handle(ev('COUNTDOWN_SECOND', 2, 5000, { context: 'round', secondsRemaining: 5 }));
    rec.handle(ev('COACH_CUE', 3, 6000, { roundIndex: 0, cueId: 'c', text: 'Move', atMs: 6000 }));
    rec.handle(ev('ROUND_STARTED', 4, 0, round(1, 'Jab')));

    // The beautiful (default) story hides the verbose detail…
    const beautiful = rec.export();
    expect(beautiful).not.toMatch(/countdown/i);
    expect(beautiful).not.toContain('Cue scheduled');
    // …but developer mode filters NOTHING — countdown + scheduled cue are there.
    const verbose = rec.export({ verbose: true });
    expect(verbose).toContain('Countdown: 5.');
    expect(verbose).toContain('Cue scheduled: Move');
    // Everything is always captured; only rendering differs.
    expect(rec.entries().some((m) => m.kind === 'countdown')).toBe(true);
    expect(rec.entries().some((m) => m.kind === 'cue')).toBe(true);

    // A new WORKOUT_STARTED wipes the prior story.
    rec.handle(ev('WORKOUT_STARTED', 5, 0, { workoutId: 'w2', totalRounds: 1, plannedDurationMs: 1000, hasWarmup: false }));
    expect(rec.entries().map((m) => m.line)).toEqual(['Workout started.']);
  });

  it('records speech interruptions (verbose) and exports valid JSON (PR-034)', () => {
    const rec = new FlightRecorder('W');
    const sink = rec.observeSpeech({ speak: () => {}, pause: () => {}, resume: () => {}, cancel: () => {}, clearPending: () => {} });
    rec.handle(ev('WORKOUT_STARTED', 1, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 1000, hasWarmup: false }));
    sink.pause();
    sink.resume();

    // Speech interruptions are verbose-only detail (kept out of the beautiful story).
    expect(rec.export()).not.toContain('Speech paused.');
    expect(rec.export({ verbose: true })).toContain('Speech paused.');
    expect(rec.export({ verbose: true })).toContain('Speech resumed.');

    // JSON export is parseable and carries every moment with its kind + formatted time.
    const parsed = JSON.parse(rec.exportJson()) as { title: string; moments: { kind: string; line: string; at: string }[] };
    expect(parsed.title).toBe('W');
    expect(parsed.moments.some((m) => m.kind === 'speech' && /paused/.test(m.line))).toBe(true);
    expect(parsed.moments[0]).toMatchObject({ kind: 'workout', at: '0:00' });
  });

  it('observeSpeech observes but never controls — every call is forwarded unchanged', () => {
    const rec = new FlightRecorder();
    const calls: string[] = [];
    const sink = rec.observeSpeech({
      speak: (t) => calls.push(`speak:${t}`),
      pause: () => calls.push('pause'),
      resume: () => calls.push('resume'),
      cancel: () => calls.push('cancel'),
      clearPending: () => calls.push('clear'),
    });
    sink.speak('x');
    sink.pause();
    sink.resume();
    sink.cancel();
    sink.clearPending();
    expect(calls).toEqual(['speak:x', 'pause', 'resume', 'cancel', 'clear']);
  });

  it('records pause/resume as the athlete leaving and returning', () => {
    const rec = new FlightRecorder();
    rec.handle(ev('WORKOUT_STARTED', 1, 0, { workoutId: 'w', totalRounds: 1, plannedDurationMs: 1000, hasWarmup: false }));
    rec.handle(ev('WORKOUT_PAUSED', 2, 20000, { phase: 'round', elapsedMs: 20000 }));
    rec.handle(ev('WORKOUT_RESUMED', 3, 20000, { phase: 'round', elapsedMs: 20000, pausedForMs: 5000 }));
    const story = rec.export();
    expect(story).toContain('Paused.');
    expect(story).toContain('Resumed.');
  });
});
