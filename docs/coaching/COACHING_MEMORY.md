# Coaching Memory (PR-020C)

The difference between a coach that *speaks* and a coach that *remembers*. Coaching
Memory is a lightweight, in-runtime record of the **teaching** — not the dialogue —
that lets the coach reinforce instead of repeat, build through concepts, and
reference a lesson when it praises.

Implemented in `src/lib/coaching/CoachingMemory.ts` (renamed from `ConversationState`).
Related: [BOXING_LEXICON.md](BOXING_LEXICON.md) · [COACH_PERFORMANCE.md](COACH_PERFORMANCE.md).

---

## What it remembers

| Field | Purpose |
|---|---|
| `currentRound` / `totalRounds` / `energy` | where we are in the session arc |
| `roundTaughtDimensions` | dimensions taught in the CURRENT round (reset each round) |
| `taughtDimensions` (session) | every dimension taught at least once this session |
| `lastTaughtDimension` | the concept an earned encouragement can reference |
| `lastTechnique` | the exact wording of the last authored technique cue |
| `reinforcementCounts` | how often each dimension has been reinforced (concept progression) |
| `recentTexts` | recent lines, to guarantee no identical wording |
| `reminderTextAt` | per-reminder cooldown |
| `introducedCallSigns` | boxing call signs already taught ([Boxing Lexicon](BOXING_LEXICON.md)) |
| `rotations` | deterministic variant counters (no RNG) |

It **remembers teaching, not dialogue** — it never mirrors engine state (remaining
time, phase machinery); those come from events.

## Guarantees

- **Lives only inside the Coach Runtime.** No Engine, Host, Event, Media, or Session
  Runtime involvement.
- **Not persisted.** Pure in-memory objects; nothing touches `localStorage`.
- **Survives pause/resume.** `WORKOUT_PAUSED`/`WORKOUT_RESUMED` operate the sink and
  flush the pending queue — they never reset memory, so a lesson taught before a pause
  is still remembered after resume.
- **Resets between workouts.** `WORKOUT_STARTED` calls `reset()`, clearing everything
  for a clean session. Verified by test.
- **Never touches Engine state.** Timing is the engine's deterministic `elapsedMs`;
  the memory only reads what it was told was spoken.

## How memory improves coaching

### Reinforcement, not repetition
The first time a dimension is taught in a round, the **authored** cue is spoken
verbatim. Every later same-dimension cue is voiced from that dimension's reinforcement
pool, rotated deterministically — *"Keep your hands high" → "Hands home!" → "Guard!"*
Recent-text memory guarantees **no identical wording** ever repeats. Per PR-028 the
pool is behavioural micro-coaching — see [COACHING_DOCTRINE.md](COACHING_DOCTRINE.md).

### Concept progression
`reinforcementCounts` tracks how often each concept has been reinforced, so the coach
can tell when it has leaned on one idea (e.g. guard reinforced twice) and the session
is building an athlete across concepts rather than replaying one recording.

### Encouragement that references teaching
When a round ends and encouragement is *earned* (the silence gate still decides),
`lastTaughtDimension` lets praise reinforce the lesson — *"Good. Hands home."* —
instead of a hollow *"Great job."* These lines are **instructions
about the taught concept, never observations**: the coach still never claims to see
the athlete.

### Vocabulary the athlete keeps
`introducedCallSigns` records which [call signs](BOXING_LEXICON.md) have been taught,
so a sign is explained exactly once and then used as shorthand — for the rest of the
session and across pause/resume.

## Silence is unchanged

Memory improves *judgement*, not *volume*. Reinforcement **replaces** a repeated line;
it never adds one. Density stays governed by the Silence Guide, and silence remains
the default (see [SILENCE_GUIDE.md](SILENCE_GUIDE.md)).

## Determinism

No randomness, no AI, no wall clock. Variety comes from rotation counters keyed by
concept; the same event stream always produces the same coaching. Verified by test
(`src/tests/coaching/memory.test.ts`: identical events → identical spoken output).
