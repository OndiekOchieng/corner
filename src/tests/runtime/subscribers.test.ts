import { describe, it, expect } from 'vitest';
import {
  EventBus,
  LoggerSubscriber,
  MemoryLogSink,
  StatsSubscriber,
  BellSubscriber,
  type BellKind,
  LOGGER_SUBSCRIBER_ID,
} from '../../lib/runtime';
import type { WorkoutEvent } from '../../lib/engine';
import { completedWorkoutEvents } from './helpers';

describe('LoggerSubscriber', () => {
  it('logs every event through the injected sink and is removable', () => {
    const bus = new EventBus();
    const sink = new MemoryLogSink();
    bus.register(new LoggerSubscriber(sink));

    const events = completedWorkoutEvents();
    bus.publishAll(events);
    expect(sink.entries).toHaveLength(events.length);
    expect(sink.entries[0].eventType).toBe(events[0].type);

    // Removable.
    expect(bus.unregister(LOGGER_SUBSCRIBER_ID)).toBe(true);
    bus.publishAll(events);
    expect(sink.entries).toHaveLength(events.length); // no new entries
  });
});

describe('StatsSubscriber', () => {
  it('observes the stream and accumulates a session summary (no persistence)', () => {
    const bus = new EventBus();
    const stats = new StatsSubscriber();
    bus.register(stats);

    bus.publishAll(completedWorkoutEvents());

    const s = stats.getStats();
    expect(s.started).toBe(true);
    expect(s.roundsStarted).toBe(3);
    expect(s.roundsCompleted).toBe(3);
    expect(s.restsStarted).toBe(2);
    expect(s.completed).toBe(true);
    expect(s.finalSession?.status).toBe('completed');
    expect(s.workoutId).toBe('w1');
  });

  it('resets its accumulation on a new WORKOUT_STARTED', () => {
    const bus = new EventBus();
    const stats = new StatsSubscriber();
    bus.register(stats);
    bus.publishAll(completedWorkoutEvents());
    bus.publishAll(completedWorkoutEvents()); // a fresh run resets at WORKOUT_STARTED
    expect(stats.getStats().roundsStarted).toBe(3); // not 6
  });
});

describe('BellSubscriber (stub)', () => {
  it('subscribes to the correct transition events and emits no audio', () => {
    const bells: BellKind[] = [];
    const bus = new EventBus();
    bus.register(new BellSubscriber((kind) => bells.push(kind)));

    bus.publishAll(completedWorkoutEvents());

    expect(bells.filter((b) => b === 'round-start')).toHaveLength(3);
    expect(bells.filter((b) => b === 'rest-start')).toHaveLength(2);
    expect(bells.filter((b) => b === 'finish')).toHaveLength(1);
    expect(bells).toContain('warning'); // the "one second" countdown
  });

  it('only handles its bell events', () => {
    const sub = new BellSubscriber();
    const cue: WorkoutEvent = {
      type: 'COACH_CUE',
      at: 0,
      elapsedMs: 0,
      seq: 0,
      data: { roundIndex: 0, cueId: 'c', text: 'x', atMs: 0 },
    };
    const roundStart: WorkoutEvent = {
      type: 'ROUND_STARTED',
      at: 0,
      elapsedMs: 0,
      seq: 1,
      data: { roundIndex: 0, roundNumber: 1, round: { id: 'r', name: 'R', workMs: 1, restMs: 0, cues: [] }, durationMs: 1 },
    };
    expect(sub.canHandle(cue)).toBe(false);
    expect(sub.canHandle(roundStart)).toBe(true);
  });
});
