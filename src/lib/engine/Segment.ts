/**
 * Segment — one contiguous span of the workout on the immutable Timeline.
 *
 * Segments tile the whole session with no gaps: `segments[n].endMs === segments[n+1].startMs`.
 * Offsets are absolute milliseconds from workout start.
 *
 * NOTE (extension seam, ADR-0001 §9.A3 / deferred ADR-0002): a segment's end is
 * a fixed `endMs` today. This is the point at which a future `Terminator` union
 * (duration | signal | command) would attach. No such runtime exists here.
 */

export type SegmentKind = 'warmup' | 'round' | 'rest';

export interface Segment {
  readonly kind: SegmentKind;
  /** Ordinal position in the Timeline's segment list. */
  readonly index: number;
  /** The round this segment belongs to (round/rest); -1 for warmup. */
  readonly roundIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

export function segmentDurationMs(segment: Segment): number {
  return segment.endMs - segment.startMs;
}
