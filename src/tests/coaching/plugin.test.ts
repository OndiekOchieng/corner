import { describe, it, expect } from 'vitest';
import { EventBus } from '../../lib/runtime';
import {
  createCoachRuntimePlugin,
  speechServiceSink,
  COACH_RUNTIME_SUBSCRIBER_ID,
} from '../../lib/coaching';
import { SpySink, fullWorkoutEvents } from './helpers';

describe('CoachRuntimePlugin — integrates as an Event Runtime subscriber', () => {
  it('comes alive on the real EventBus with no engine/runtime changes', () => {
    const sink = new SpySink();
    const plugin = createCoachRuntimePlugin({
      personality: 'fightnight',
      sink,
      workoutName: 'Fight Night',
    });
    const bus = new EventBus();
    bus.register(plugin);

    bus.publishAll(fullWorkoutEvents());

    expect(plugin.id).toBe(COACH_RUNTIME_SUBSCRIBER_ID);
    expect(sink.spoken.length).toBeGreaterThan(0);
    expect(sink.spoken[0]).toContain('Fight Night');
    expect(plugin.diagnostics().actionsSpoken).toBe(sink.spoken.length);
  });

  it('produces distinct sessions for distinct coach packs on identical events', () => {
    const events = fullWorkoutEvents();

    const techSink = new SpySink();
    const techBus = new EventBus();
    techBus.register(createCoachRuntimePlugin({ personality: 'technical', sink: techSink, workoutName: 'W' }));
    techBus.publishAll(events);

    const swpSink = new SpySink();
    const swpBus = new EventBus();
    swpBus.register(createCoachRuntimePlugin({ personality: 'southpaw', sink: swpSink, workoutName: 'W' }));
    swpBus.publishAll(events);

    expect(techSink.spoken).not.toEqual(swpSink.spoken);
    expect(swpSink.spoken.join(' ')).toMatch(/southpaw|outside|angle|left/i);
  });

  it('is deterministic across independent runs', () => {
    const events = fullWorkoutEvents();
    const runOnce = () => {
      const sink = new SpySink();
      const bus = new EventBus();
      bus.register(createCoachRuntimePlugin({ personality: 'calm', sink, workoutName: 'W' }));
      bus.publishAll(events);
      return sink.spoken;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('speechServiceSink — adapts the existing SpeechService, never bypasses it', () => {
  it('maps sink operations onto the service (clearPending → clearQueue)', () => {
    const calls: string[] = [];
    const fakeService = {
      speak: (t: string) => calls.push(`speak:${t}`),
      pause: () => calls.push('pause'),
      resume: () => calls.push('resume'),
      cancel: () => calls.push('cancel'),
      clearQueue: () => calls.push('clearQueue'),
    };
    const sink = speechServiceSink(fakeService);

    sink.speak('Jab and move');
    sink.pause();
    sink.resume();
    sink.cancel();
    sink.clearPending();

    expect(calls).toEqual(['speak:Jab and move', 'pause', 'resume', 'cancel', 'clearQueue']);
  });
});
