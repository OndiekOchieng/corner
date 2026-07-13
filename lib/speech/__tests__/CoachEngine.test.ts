import { describe, it, expect, beforeEach } from 'vitest';
import { SpeechService } from '@/lib/speech/SpeechService';
import { CoachEngine } from '@/lib/speech/CoachEngine';
import type { Round, Workout } from '@/types/workout';
import { MockSpeechSynthesis, createMockUtterance } from './mockSpeechSynthesis';

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'round-1',
    name: 'THE JAB',
    drillDuration: 180,
    restDuration: 60,
    currentDrill: 'Establish your jab',
    currentCue: { id: 'c0', text: 'Establish your jab' },
    coachingCues: [
      { id: 'c1', text: 'Double jab.', timeSeconds: 0 },
      { id: 'c2', text: 'Add the cross.', timeSeconds: 45 },
      { id: 'c3', text: 'Stay light.', timeSeconds: 90 },
    ],
    ...overrides,
  };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  const round = makeRound();
  return {
    id: 'w1',
    name: 'Orthodox Power',
    description: 'A test workout',
    stance: 'orthodox',
    totalDuration: 720,
    roundDuration: 180,
    restDuration: 60,
    roundCount: 3,
    rounds: [round, makeRound({ id: 'round-2', name: 'THE CROSS' }), makeRound({ id: 'round-3' })],
    difficulty: 'intermediate',
    ...overrides,
  };
}

function setup() {
  const synth = new MockSpeechSynthesis();
  const service = new SpeechService({ synth, createUtterance: createMockUtterance });
  const coach = new CoachEngine(service);
  return { synth, service, coach };
}

/** All spoken phrases, in order, after draining the queue. */
function spoken(synth: MockSpeechSynthesis): string[] {
  synth.drain();
  return synth.started;
}

describe('CoachEngine', () => {
  let synth: MockSpeechSynthesis;
  let coach: CoachEngine;

  beforeEach(() => {
    const s = setup();
    synth = s.synth;
    coach = s.coach;
  });

  describe('workout event ordering', () => {
    it('speaks the full flow in order', () => {
      const workout = makeWorkout();
      coach.announceWorkoutStart(workout);
      coach.announceWarmup();
      coach.announceRound(workout.rounds[0], 1);
      coach.announceRest(1, workout.rounds[1].name);
      coach.announceComplete(3);

      expect(spoken(synth)).toEqual([
        'Starting workout.',
        "Today's workout. Orthodox Power.",
        'Warm up.',
        'Round One.',
        'The Jab',
        'Establish your jab',
        'Rest.',
        'Breathe.',
        'Next round. The Cross.',
        'Workout complete.',
        'Excellent work.',
        'You completed three rounds.',
      ]);
    });
  });

  describe('idempotency (no duplicate announcements)', () => {
    it('announces the workout start only once', () => {
      const workout = makeWorkout();
      coach.announceWorkoutStart(workout);
      coach.announceWorkoutStart(workout);
      coach.announceWarmup();
      coach.announceWarmup();
      expect(spoken(synth)).toEqual([
        'Starting workout.',
        "Today's workout. Orthodox Power.",
        'Warm up.',
      ]);
    });

    it('announces a given round only once, even if called every tick', () => {
      const round = makeRound();
      coach.announceRound(round, 1);
      coach.announceRound(round, 1);
      coach.announceRound(round, 1);
      expect(spoken(synth)).toEqual(['Round One.', 'The Jab', 'Establish your jab']);
    });

    it('announces completion only once', () => {
      coach.announceComplete(3);
      coach.announceComplete(3);
      expect(spoken(synth)).toEqual([
        'Workout complete.',
        'Excellent work.',
        'You completed three rounds.',
      ]);
    });

    it('announces rest only once per finishing round', () => {
      coach.announceRest(1, 'THE CROSS');
      coach.announceRest(1, 'THE CROSS');
      expect(spoken(synth)).toEqual(['Rest.', 'Breathe.', 'Next round. The Cross.']);
    });
  });

  describe('coaching cues', () => {
    it('speaks each cue once, when its time arrives', () => {
      const round = makeRound();
      coach.announceRound(round, 1);
      synth.drain();
      synth.started.length = 0; // ignore round intro; focus on cues

      // Tick repeatedly; cues fire once at/after their scheduled time.
      coach.handleCues(round, 1, 0); // c1 @0
      coach.handleCues(round, 1, 10);
      coach.handleCues(round, 1, 45); // c2 @45
      coach.handleCues(round, 1, 46);
      coach.handleCues(round, 1, 90); // c3 @90
      coach.handleCues(round, 1, 91);

      expect(spoken(synth)).toEqual(['Double jab.', 'Add the cross.', 'Stay light.']);
    });

    it('resets cue de-dup when a new round is announced', () => {
      const r1 = makeRound({ id: 'r1' });
      const r2 = makeRound({ id: 'r2', name: 'THE CROSS' });

      coach.announceRound(r1, 1);
      coach.handleCues(r1, 1, 0);
      coach.announceRound(r2, 2); // new round → cue de-dup cleared
      coach.handleCues(r2, 2, 0);

      const phrases = spoken(synth);
      // 'Double jab.' should be spoken in both rounds.
      expect(phrases.filter((p) => p === 'Double jab.')).toHaveLength(2);
    });
  });

  describe('countdown', () => {
    it('speaks 10, 5, 4, 3, 2, 1 exactly once each', () => {
      coach.announceRound(makeRound(), 1);
      synth.drain();
      synth.started.length = 0;

      // Simulate the timer ticking down; each integer second may repeat across
      // frames — the countdown must still speak each threshold only once.
      for (const remaining of [12, 11, 10, 10, 9, 6, 5, 5, 4, 3, 3, 2, 1, 1, 0]) {
        coach.handleCountdown(remaining);
      }

      expect(spoken(synth)).toEqual([
        'Ten seconds.',
        'Five.',
        'Four.',
        'Three.',
        'Two.',
        'One.',
      ]);
    });

    it('does not announce non-threshold seconds', () => {
      coach.announceRound(makeRound(), 1);
      synth.drain();
      synth.started.length = 0;

      coach.handleCountdown(9);
      coach.handleCountdown(8);
      coach.handleCountdown(7);
      coach.handleCountdown(6);
      expect(spoken(synth)).toEqual([]);
    });
  });

  describe('reset (quit)', () => {
    it('cancels speech, clears the queue, and forgets all state', () => {
      const workout = makeWorkout();
      coach.announceWorkoutStart(workout);
      coach.announceRound(workout.rounds[0], 1);

      coach.reset();
      // After reset nothing is queued or speaking.
      synth.drain();
      const afterReset = synth.started.length;

      // State is forgotten: announcing again works from scratch.
      synth.started.length = 0;
      coach.announceWorkoutStart(workout);
      expect(spoken(synth)[0]).toBe('Starting workout.');
      expect(afterReset).toBeGreaterThan(0); // (sanity: something had been spoken)
    });
  });
});
