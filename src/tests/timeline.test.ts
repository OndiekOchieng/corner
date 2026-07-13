import { describe, it, expect } from 'vitest';
import { buildTimeline, TimelineError } from '../lib/engine';
import { makeConfig, round, cue } from './fixtures';

describe('Timeline construction', () => {
  it('lays out contiguous segments with absolute offsets', () => {
    const tl = buildTimeline(makeConfig());
    const segs = tl.segments.map((s) => [s.kind, s.roundIndex, s.startMs, s.endMs]);
    expect(segs).toEqual([
      ['warmup', -1, 0, 4000],
      ['round', 0, 4000, 16000],
      ['rest', 0, 16000, 19000],
      ['round', 1, 19000, 31000],
      ['rest', 1, 31000, 34000],
      ['round', 2, 34000, 46000],
    ]);
    expect(tl.totalMs).toBe(46000);
    expect(tl.roundCount).toBe(3);
    expect(tl.hasWarmup).toBe(true);
  });

  it('omits warmup when warmupMs is 0', () => {
    const tl = buildTimeline(makeConfig({ warmupMs: 0 }));
    expect(tl.hasWarmup).toBe(false);
    expect(tl.segments[0].kind).toBe('round');
  });

  it('never emits a rest after the final round (even if restMs > 0)', () => {
    const tl = buildTimeline(
      makeConfig({
        rounds: [round('a', 'A', 10000, 5000), round('b', 'B', 10000, 5000)],
      })
    );
    const restForLast = tl.segments.find((s) => s.kind === 'rest' && s.roundIndex === 1);
    expect(restForLast).toBeUndefined();
    // Exactly one rest (between the two rounds).
    expect(tl.segments.filter((s) => s.kind === 'rest')).toHaveLength(1);
  });

  it('honours per-round durations', () => {
    const tl = buildTimeline(
      makeConfig({
        warmupMs: 0,
        rounds: [round('a', 'A', 5000, 1000), round('b', 'B', 20000, 0)],
      })
    );
    const a = tl.findSegment('round', 0)!;
    const b = tl.findSegment('round', 1)!;
    expect(a.endMs - a.startMs).toBe(5000);
    expect(b.endMs - b.startMs).toBe(20000);
  });

  it('schedules countdown markers relative to each segment end', () => {
    const tl = buildTimeline(makeConfig());
    const countdowns = tl
      .markers()
      .filter((m) => m.kind === 'countdown-second' && m.segmentIndex === 1); // round0
    // round0 ends at 16000 → 10,5,4,3,2,1 s remaining.
    expect(countdowns.map((m) => (m.kind === 'countdown-second' ? m.atMs : -1))).toEqual([
      6000, 11000, 12000, 13000, 14000, 15000,
    ]);
    const start = tl.markers().find((m) => m.kind === 'countdown-start' && m.segmentIndex === 1);
    expect(start && start.kind === 'countdown-start' ? start.fromSeconds : null).toBe(10);
  });

  it('schedules cue markers at round-start + offset', () => {
    const tl = buildTimeline(makeConfig());
    const cues = tl.markers().filter((m) => m.kind === 'cue');
    expect(cues.map((m) => (m.kind === 'cue' ? m.atMs : -1))).toEqual([10000, 25000, 40000]);
  });

  it('keeps the schedule sorted by offset then tie-break order', () => {
    const tl = buildTimeline(makeConfig());
    const all = tl.entriesInRange(-1, tl.totalMs);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].atMs).toBeGreaterThanOrEqual(all[i - 1].atMs);
    }
  });
});

describe('Timeline validation', () => {
  it('rejects non-positive work durations', () => {
    expect(() => buildTimeline(makeConfig({ rounds: [round('a', 'A', 0, 0)] }))).toThrow(TimelineError);
  });

  it('rejects negative rest durations', () => {
    expect(() => buildTimeline(makeConfig({ rounds: [round('a', 'A', 1000, -5)] }))).toThrow(TimelineError);
  });

  it('rejects negative warmup', () => {
    expect(() => buildTimeline(makeConfig({ warmupMs: -1 }))).toThrow(TimelineError);
  });

  it('rejects an empty round list', () => {
    expect(() => buildTimeline(makeConfig({ rounds: [] }))).toThrow(TimelineError);
  });

  it('rejects a cue outside its round', () => {
    expect(() =>
      buildTimeline(makeConfig({ rounds: [round('a', 'A', 5000, 0, [cue('x', 'late', 5000)])] }))
    ).toThrow(TimelineError);
  });

  it('rejects duplicate markers (same cue id at same offset)', () => {
    expect(() =>
      buildTimeline(
        makeConfig({
          rounds: [round('a', 'A', 8000, 0, [cue('dup', 'one', 2000), cue('dup', 'two', 2000)])],
        })
      )
    ).toThrow(TimelineError);
  });

  it('rejects non-integer countdown leads', () => {
    expect(() => buildTimeline(makeConfig({ countdownLeadSeconds: [10, 2.5] }))).toThrow(TimelineError);
  });
});
