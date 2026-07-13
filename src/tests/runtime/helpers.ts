import type { Subscriber, Coach } from '../../lib/runtime';
import type { WorkoutEvent } from '../../lib/engine';
import { Engine, FakeClock } from '../../lib/engine';
import { makeConfig, seqIds } from '../fixtures';

/** A minimal valid ROUND_STARTED event for bus-level tests. */
export function roundStartedEvent(seq: number, elapsedMs = 0): WorkoutEvent {
  return {
    type: 'ROUND_STARTED',
    at: 0,
    elapsedMs,
    seq,
    data: {
      roundIndex: 0,
      roundNumber: 1,
      round: { id: 'r0', name: 'R0', workMs: 1000, restMs: 0, cues: [] },
      durationMs: 1000,
    },
  };
}

/** Records the global delivery order into a shared log; can be made to throw. */
export class OrderSub implements Subscriber {
  constructor(
    readonly id: string,
    readonly priority: number,
    private readonly log: string[],
    private readonly opts: { throwOn?: boolean } = {}
  ) {}
  canHandle(): boolean {
    return true;
  }
  handle(): void {
    if (this.opts.throwOn) throw new Error(`${this.id} failed`);
    this.log.push(this.id);
  }
}

/** Records the events it receives. */
export class CountingSub implements Subscriber {
  readonly received: WorkoutEvent[] = [];
  constructor(
    readonly id: string,
    readonly priority: number,
    private readonly filter?: (e: WorkoutEvent) => boolean
  ) {}
  canHandle(e: WorkoutEvent): boolean {
    return this.filter ? this.filter(e) : true;
  }
  handle(e: WorkoutEvent): void {
    this.received.push(e);
  }
}

/** Records every Coach port call for mapping assertions. */
export class SpyCoach implements Coach {
  readonly calls: Array<[string, ...unknown[]]> = [];
  workoutStarted(name: string): void {
    this.calls.push(['workoutStarted', name]);
  }
  warmupStarted(): void {
    this.calls.push(['warmupStarted']);
  }
  roundStarted(n: number, name: string): void {
    this.calls.push(['roundStarted', n, name]);
  }
  cue(id: string, text: string): void {
    this.calls.push(['cue', id, text]);
  }
  countdown(s: number): void {
    this.calls.push(['countdown', s]);
  }
  restStarted(f: number, name: string): void {
    this.calls.push(['restStarted', f, name]);
  }
  completed(t: number): void {
    this.calls.push(['completed', t]);
  }
  paused(): void {
    this.calls.push(['paused']);
  }
  resumed(): void {
    this.calls.push(['resumed']);
  }
  cancelled(): void {
    this.calls.push(['cancelled']);
  }
}

/** Run a full workout and return its complete, ordered event stream. */
export function completedWorkoutEvents(): readonly WorkoutEvent[] {
  const clock = new FakeClock(0);
  const engine = new Engine(makeConfig(), { clock, idFactory: seqIds() });
  engine.start();
  for (let t = 250; t <= 46000; t += 250) {
    clock.set(t);
    engine.advance();
  }
  return engine.events();
}

/** A `now` that advances by a fixed step each call — deterministic timing for diagnostics. */
export function steppingNow(step = 1): () => number {
  let t = 0;
  return () => {
    const v = t;
    t += step;
    return v;
  };
}
