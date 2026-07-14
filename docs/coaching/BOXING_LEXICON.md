# Boxing Lexicon (PR-020C)

Corner should teach the athlete how coaches actually speak. The **Boxing Lexicon**
is the authentic terminology — call signs, punches, combinations — expressed at the
right level for each Coach Pack, and taught before it is assumed.

Implemented in `src/lib/coaching/BoxingLexicon.ts` (pure + deterministic). Related:
[COACHING_MEMORY.md](COACHING_MEMORY.md) · [PERSONALITY_SYSTEM.md](PERSONALITY_SYSTEM.md) ·
[CUE_LIBRARY.md](../workouts/CUE_LIBRARY.md).

---

## Call signs

The universal numeric system every gym uses:

| # | Punch | Call sign |
|---|---|---|
| 1 | Jab | "one" |
| 2 | Cross | "two" |
| 3 | Lead hook | "three" |
| 4 | Rear hook | "four" |
| 5 | Lead uppercut | "five" |
| 6 | Rear uppercut | "six" |

A **combination** is a sequence of numbers (`[1, 2, 6]` = jab–cross–rear uppercut).
Southpaw and very technical coaches prefer **lead/rear** naming ("Lead hand", "Rear
hand") over orthodox names.

## Language progression

Terminology is introduced gradually — the lexicon renders a combo at one of four
levels:

| Level | Name | `[1, 2, 6]` renders as |
|---|---|---|
| 1 | Plain | `Jab. Cross. Rear uppercut.` |
| 2 | Mixed | `Jab, cross, rear uppercut.` |
| 3 | Coach | `One. Two. Six.` |
| 4 | Call signs | `One-two-six.` |

## Per-pack expression (same combo, different coach)

Each pack adopts terminology differently (`PACK_VOCABULARY`). The same `[1, 2, 6]`:

| Pack | Renders | Style |
|---|---|---|
| Technical | `Jab. Cross. Rear uppercut.` | plain names, explains |
| Calm | `Let's finish with the rear uppercut.` | soft framing of the finisher |
| Southpaw | `Lead hand. Rear hand. Rear uppercut.` | stance-specific lead/rear naming |
| Old School | `One-two-six.` | authentic gym shorthand |
| Fight Night | `One-two-six!` | energetic shorthand |
| Competition | `Six. Again.` | minimal — the finisher only |

`renderCombo(numbers, packId)` is pure: same combo + pack → same words, always.

## Teaching vocabulary — through exposure (PR-027B)

The coach must never assume the athlete knows the numbers, but it must not run a
classroom either. **Teach through exposure:** the FIRST time a call-sign pack meets a
combination it says *both forms in one line* — the call signs, then the translation —
and the whole combo's vocabulary is recorded as known. Every later occurrence uses the
pure shorthand.

```
First   "One-two-three. Jab, cross, lead hook."   ← both forms, one line → 1,2,3 now known
Later   "One-two!"                                  ← shorthand (1,2 already known)
Later   "One-two-three!"                            ← authentic boxing language, no lesson
```

Per pack, the first exposure:

| Pack | First exposure | Later |
|---|---|---|
| Fight Night | "One-two-three. Jab, cross, lead hook." | "One-two-three!" |
| Old School | "One-two. Jab, cross." | "One-two." |
| Competition | "One-six. Jab, rear uppercut." | "Six. Again." |

**Why one exposure, not one-sign-per-cue.** The earlier model taught a single call sign
per combination cue, so a call-sign coach stayed in "teaching mode" for an entire
workout when there were few combo cues — the athlete rarely heard authentic boxing
language (the PR-027A audit found the default coach never reached shorthand). Exposure
flips that: one line teaches the whole combination, and from the next occurrence the
coach speaks like a real corner. The goal is coaching, not instruction — the athlete
gradually thinks in call signs and never feels they are attending a lesson.

Which signs are known lives in [Coaching Memory](COACHING_MEMORY.md)
(`introducedCallSigns`); a sign becomes known after its first *translated exposure*,
recorded at commit time, and survives pause/resume. Name-based packs (Technical, Calm,
Southpaw) never expose — their words are self-explanatory. (Note: punch **3** is the
*lead hook* and **4** the *rear hook*, so the translation is "lead hook", not a bare
"hook".)

## Boundaries

- **Pure Coach Runtime.** The lexicon is data + deterministic rendering; no Engine,
  Event, Media, or browser involvement, no randomness, no wall clock.
- **Authored cues stay verbatim.** The lexicon renders the coach's *own* combination
  calls; it never rewrites an authored `instruction`/`reminder`/`correction` cue (those
  are still spoken exactly as the Cue Library wrote them).

## Wiring (shipped in PR-020D)

The lexicon is now driven from the live event stream. Authored cues carry optional
`combination` metadata (`[1, 2, 6]`); the composition builds a `cueId → combination`
map and passes it on `CoachContext`; the Director recognises a combination cue **by id**
(no string parsing) and emits a `combination` intent; the SpeechPlanner renders it with
`planCombo()`, and on a first exposure the runtime records the whole combo's
vocabulary as known at *commit* time (so a combo silenced by the density gate is never
wrongly recorded as exposed).

```
Cue { kind: 'combination', combination: [1,2,6] }
  → toWorkoutConfig drops it; the Engine still schedules the cue by id/text (unchanged)
  → composition: buildCombinations(workout) → CoachContext.combinations
  → CoachDirector.onEvent(COACH_CUE): combinations.get(cueId) → { intent: 'combination' }
  → SpeechPlanner.plan('combination') → planCombo(numbers, pack, memory)
  → CoachRuntime commits → on a first exposure, records the whole combo's vocabulary
```

No Engine, Host, Event, Media, or Session change — the combination rides on
Coach-Runtime config, never on the engine event. Tested in
`src/tests/coaching/combinations.test.ts` and `memory.test.ts`.
