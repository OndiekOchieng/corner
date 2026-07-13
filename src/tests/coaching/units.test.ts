import { describe, it, expect } from 'vitest';
import {
  classifyCue,
  priorityFor,
  shouldInterrupt,
  compare,
  SpeechPlanner,
  QueueManager,
  ConversationState,
  decideSilence,
  personalityFor,
  DEFAULT_COACH_CONFIG,
  type CoachAction,
  type CoachIntent,
  type ConversationSnapshot,
} from '../../lib/coaching';
import { SpySink } from './helpers';

// --- Cue classification ------------------------------------------------------

describe('classifyCue — event judgement', () => {
  it('detects corrections, reminders, and plain instructions', () => {
    expect(classifyCue("Don't drop the hands")).toBe('correction');
    expect(classifyCue('Same line — snap it back')).toBe('correction');
    expect(classifyCue('Hands back')).toBe('reminder');
    expect(classifyCue('Breathe with the shots')).toBe('reminder');
    expect(classifyCue('Turn the hip')).toBe('instruction');
    expect(classifyCue('Sit down on the cross')).toBe('instruction');
  });
});

// --- Priority rules ----------------------------------------------------------

describe('PriorityResolver — deterministic ordering', () => {
  it('orders intents by criticality', () => {
    expect(priorityFor('countdown')).toBeGreaterThan(priorityFor('finish'));
    expect(priorityFor('finish')).toBeGreaterThan(priorityFor('round_intro'));
    expect(priorityFor('round_intro')).toBeGreaterThan(priorityFor('correction'));
    expect(priorityFor('correction')).toBeGreaterThan(priorityFor('instruction'));
    expect(priorityFor('instruction')).toBeGreaterThan(priorityFor('encouragement'));
  });

  const act = (intent: CoachIntent, priority: number): CoachAction => ({
    id: `x:${intent}`,
    intent,
    priority,
    text: intent,
    sourceSeq: 1,
    createdElapsedMs: 0,
    expiresElapsedMs: null,
    interrupt: intent === 'countdown' || intent === 'finish',
  });

  it('interrupts only when a critical line outranks the last rendered one', () => {
    const countdown = act('countdown', 100);
    const cue = act('instruction', 44);
    expect(shouldInterrupt(countdown, cue)).toBe(true); // count cuts chatter
    expect(shouldInterrupt(countdown, countdown)).toBe(false); // numbers don't cut each other
    expect(shouldInterrupt(cue, countdown)).toBe(false); // chatter never cuts
    expect(shouldInterrupt(countdown, null)).toBe(false); // nothing to cut
  });

  it('compare sorts by priority desc', () => {
    const sorted = [act('instruction', 44), act('countdown', 100), act('reminder', 40)].sort(compare);
    expect(sorted.map((a) => a.intent)).toEqual(['countdown', 'instruction', 'reminder']);
  });
});

// --- Speech planning ---------------------------------------------------------

describe('SpeechPlanner — wording', () => {
  const convo = () => new ConversationState(5);

  it('renders exact countdown number words', () => {
    const planner = new SpeechPlanner(personalityFor('technical'));
    const c = convo();
    expect(planner.plan('countdown', { secondsRemaining: 10 }, c)).toBe('Ten seconds.');
    expect(planner.plan('countdown', { secondsRemaining: 5 }, c)).toBe('Five.');
    expect(planner.plan('countdown', { secondsRemaining: 1 }, c)).toBe('One.');
  });

  it('speaks authored cue text verbatim', () => {
    const planner = new SpeechPlanner(personalityFor('oldschool'));
    expect(planner.plan('instruction', { cueText: 'Sit down on the cross' }, convo())).toBe(
      'Sit down on the cross',
    );
  });

  it('fills personality templates and rotates variants (no repeat)', () => {
    const planner = new SpeechPlanner(personalityFor('technical'));
    const c = convo();
    const a = planner.plan('workout_intro', { workoutName: 'Orthodox Power', totalRounds: 3 }, c);
    const b = planner.plan('workout_intro', { workoutName: 'Orthodox Power', totalRounds: 3 }, c);
    expect(a).toContain('Orthodox Power');
    expect(a).not.toEqual(b); // rotation gives a different variant
  });

  it('produces different wording for different personalities', () => {
    const p = { workoutName: 'Footwork Essentials', totalRounds: 4 };
    const tech = new SpeechPlanner(personalityFor('technical')).plan('workout_intro', p, convo());
    const old = new SpeechPlanner(personalityFor('oldschool')).plan('workout_intro', p, convo());
    expect(tech).not.toEqual(old);
  });
});

// --- Queue behaviour ---------------------------------------------------------

describe('QueueManager — enqueue/replace/discard/flush/expire/drain', () => {
  const act = (intent: CoachIntent, priority: number, over: Partial<CoachAction> = {}): CoachAction => ({
    id: `${intent}:${priority}`,
    intent,
    priority,
    text: over.text ?? intent,
    sourceSeq: over.sourceSeq ?? 1,
    createdElapsedMs: over.createdElapsedMs ?? 0,
    expiresElapsedMs: over.expiresElapsedMs ?? null,
    interrupt: over.interrupt ?? false,
  });

  it('replaces an unspoken same-intent line', () => {
    const q = new QueueManager(4);
    q.enqueue(act('reminder', 40, { text: 'Hands back' }));
    const discarded = q.enqueue(act('reminder', 40, { text: 'Guard home' }));
    expect(discarded.map((a) => a.text)).toEqual(['Hands back']);
    expect(q.depth).toBe(1);
  });

  it('discards the lowest-priority action past maxDepth', () => {
    const q = new QueueManager(2);
    q.enqueue(act('round_intro', 78));
    q.enqueue(act('instruction', 44));
    const discarded = q.enqueue(act('encouragement', 22));
    expect(discarded.map((a) => a.intent)).toEqual(['encouragement']);
    expect(q.depth).toBe(2);
  });

  it('expires stale actions by engine elapsed', () => {
    const q = new QueueManager(4);
    q.enqueue(act('urgency', 60, { createdElapsedMs: 1000, expiresElapsedMs: 3000 }));
    expect(q.expire(2000)).toHaveLength(0); // not yet stale
    expect(q.expire(3000)).toHaveLength(1); // now stale
    expect(q.depth).toBe(0);
  });

  it('flush drops everything (no replay)', () => {
    const q = new QueueManager(4);
    q.enqueue(act('instruction', 44));
    q.enqueue(act('reminder', 40));
    expect(q.flush()).toHaveLength(2);
    expect(q.depth).toBe(0);
  });

  it('drains in priority order and interrupts with a critical line', () => {
    const q = new QueueManager(4);
    const sink = new SpySink();

    q.enqueue(act('instruction', 44, { text: 'Jab and move' }));
    q.drain(sink, 0);
    expect(sink.spoken).toEqual(['Jab and move']);

    q.enqueue(act('countdown', 100, { text: 'Ten seconds.', interrupt: true }));
    q.drain(sink, 1000);
    // countdown cut the lingering cue exactly once
    expect(sink.calls).toEqual(['speak:Jab and move', 'cancel', 'speak:Ten seconds.']);

    q.enqueue(act('countdown', 100, { text: 'Five.', interrupt: true }));
    q.drain(sink, 2000);
    // a second number does NOT cancel the first
    expect(sink.calls.filter((c) => c === 'cancel')).toHaveLength(1);
  });
});

// --- Silence decisions -------------------------------------------------------

describe('SilenceController — intentional silence', () => {
  const profile = personalityFor('technical');
  const base = (over: Partial<ConversationSnapshot> = {}): ConversationSnapshot => ({
    currentRound: 2,
    totalRounds: 3,
    energy: 'steady',
    lastIntent: null,
    lastSpokenElapsedMs: null,
    lastCoachingElapsedMs: null,
    lastCorrectionElapsedMs: null,
    lastEncouragementElapsedMs: null,
    recentTexts: [],
    linesSpoken: 0,
    ...over,
  });
  const cfg = DEFAULT_COACH_CONFIG;

  it('never silences the trust skeleton', () => {
    for (const intent of ['workout_intro', 'round_intro', 'rest_intro', 'countdown', 'finish'] as const) {
      expect(decideSilence(intent, base(), {}, cfg, profile, 30000).speak).toBe(true);
    }
  });

  it('spaces coaching lines apart', () => {
    expect(decideSilence('instruction', base({ lastCoachingElapsedMs: 0 }), {}, cfg, profile, 3000).speak).toBe(false);
    expect(decideSilence('instruction', base({ lastCoachingElapsedMs: 0 }), {}, cfg, profile, 9000).speak).toBe(true);
  });

  it('keeps encouragement earned — cooled down and never after a correction', () => {
    expect(
      decideSilence('encouragement', base({ lastEncouragementElapsedMs: 10000 }), {}, cfg, profile, 20000).speak,
    ).toBe(false); // still on cooldown
    expect(
      decideSilence('encouragement', base({ lastCorrectionElapsedMs: 29000 }), {}, cfg, profile, 30000).speak,
    ).toBe(false); // right after a correction
  });

  it('paces teaching by cadence, not every rest', () => {
    expect(decideSilence('teaching', base({ currentRound: 1 }), {}, cfg, profile, 30000).speak).toBe(false);
    expect(decideSilence('teaching', base({ currentRound: 2 }), {}, cfg, profile, 30000).speak).toBe(true);
  });
});
