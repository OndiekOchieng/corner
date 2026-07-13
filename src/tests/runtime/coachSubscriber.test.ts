import { describe, it, expect } from 'vitest';
import { EventBus, CoachSubscriber } from '../../lib/runtime';
import { CoachEngineAdapter } from '../../lib/integration';
import { SpeechService } from '@/lib/speech/SpeechService';
import { CoachEngine } from '@/lib/speech/CoachEngine';
import { MockSpeechSynthesis, createMockUtterance } from '@/lib/speech/__tests__/mockSpeechSynthesis';
import { SpyCoach, completedWorkoutEvents } from './helpers';

describe('CoachSubscriber — event → coach mapping', () => {
  it('translates each runtime event into the right coach action', () => {
    const coach = new SpyCoach();
    const sub = new CoachSubscriber(coach, { workoutName: 'Test Bout' });
    const bus = new EventBus();
    bus.register(sub);

    bus.publishAll(completedWorkoutEvents());

    const calls = coach.calls.map((c) => c[0]);
    expect(calls[0]).toBe('workoutStarted');
    expect(coach.calls[0]).toEqual(['workoutStarted', 'Test Bout']);
    expect(calls).toContain('warmupStarted');
    expect(calls.filter((c) => c === 'roundStarted')).toHaveLength(3);
    expect(calls.filter((c) => c === 'restStarted')).toHaveLength(2);
    expect(calls).toContain('cue');
    expect(calls).toContain('countdown');
    expect(calls[calls.length - 1]).toBe('completed');
  });

  it('does not handle events outside its interest', () => {
    const sub = new CoachSubscriber(new SpyCoach());
    expect(
      sub.canHandle({ type: 'WARMUP_COMPLETED', at: 0, elapsedMs: 0, seq: 0, data: {} })
    ).toBe(false);
    expect(
      sub.canHandle({ type: 'REST_COMPLETED', at: 0, elapsedMs: 0, seq: 0, data: { restIndex: 0 } })
    ).toBe(false);
  });
});

describe('CoachSubscriber — end-to-end through the PR-001 CoachEngine', () => {
  it('speaks the full coaching flow through the real SpeechService (mocked synth)', () => {
    const synth = new MockSpeechSynthesis();
    const speech = new SpeechService({ synth, createUtterance: createMockUtterance });
    const coach = new CoachEngine(speech);
    const adapter = new CoachEngineAdapter(coach);

    const bus = new EventBus();
    bus.register(new CoachSubscriber(adapter, { workoutName: 'Orthodox Power' }));

    bus.publishAll(completedWorkoutEvents());
    synth.drain();

    const spoken = synth.started;
    expect(spoken).toContain('Starting workout.');
    expect(spoken).toContain('Warm up.');
    expect(spoken).toContain('Round One.');
    expect(spoken).toContain('Jab'); // round 0 name
    expect(spoken).toContain('Ten seconds.');
    expect(spoken).toContain('One.');
    expect(spoken).toContain('Rest.');
    expect(spoken).toContain('Workout complete.');

    // "Starting workout." precedes "Round One." (ordering preserved through the queue).
    expect(spoken.indexOf('Starting workout.')).toBeLessThan(spoken.indexOf('Round One.'));
  });

  it('is the only coupling point — a failing coach does not break the bus', () => {
    const bus = new EventBus();
    // A coach whose adapter throws on cue must not stop other subscribers.
    const throwingCoach = {
      ...new SpyCoach(),
      cue() {
        throw new Error('speech backend down');
      },
    };
    bus.register(new CoachSubscriber(throwingCoach as never));
    const reports = bus.publishAll(completedWorkoutEvents());
    const totalFailures = reports.reduce((n, r) => n + r.failures, 0);
    expect(totalFailures).toBeGreaterThan(0); // cues threw
    expect(bus.getDiagnostics().failureCount).toBeGreaterThan(0);
  });
});
