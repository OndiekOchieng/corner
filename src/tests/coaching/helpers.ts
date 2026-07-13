import type { WorkoutEvent } from '../../lib/engine';
import { Engine, FakeClock } from '../../lib/engine';
import type { WorkoutConfig } from '../../types/workout-config';
import type { SpeechSink } from '../../lib/coaching';
import { makeConfig, seqIds } from '../fixtures';

/** Records every call to the SpeechSink for assertions. */
export class SpySink implements SpeechSink {
  readonly spoken: string[] = [];
  readonly calls: string[] = [];
  speak(text: string): void {
    this.spoken.push(text);
    this.calls.push(`speak:${text}`);
  }
  pause(): void {
    this.calls.push('pause');
  }
  resume(): void {
    this.calls.push('resume');
  }
  cancel(): void {
    this.calls.push('cancel');
  }
  clearPending(): void {
    this.calls.push('clearPending');
  }
}

/** Run a full workout on the deterministic FakeClock and return its event stream. */
export function fullWorkoutEvents(config: WorkoutConfig = makeConfig()): WorkoutEvent[] {
  const clock = new FakeClock(0);
  const engine = new Engine(config, { clock, idFactory: seqIds() });
  engine.start();
  for (let t = 250; t <= 46000; t += 250) {
    clock.set(t);
    engine.advance();
  }
  return [...engine.events()];
}

/** Convenience event constructor for focused unit tests. */
export function evt<T extends WorkoutEvent['type']>(
  type: T,
  seq: number,
  elapsedMs: number,
  data: Extract<WorkoutEvent, { type: T }>['data'],
): WorkoutEvent {
  return { type, at: elapsedMs, elapsedMs, seq, data } as WorkoutEvent;
}
