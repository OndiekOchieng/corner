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

## Teaching vocabulary (never assume it)

The coach must never assume the athlete knows the numbers. `renderComboTaught()`
teaches a call sign the first time it appears, then uses the shorthand — the athlete
learns the language simply by training:

```
Round 1   "Every time I say one, I mean the jab."     ← taught, remembered
Later     "Every time I say two, I mean the cross."   ← taught, remembered
Later     "One-two."                                   ← shorthand (both known)
```

Which signs have been introduced lives in [Coaching Memory](COACHING_MEMORY.md)
(`introducedCallSigns`), so teaching happens exactly once per session and survives
pause/resume. Name-based packs (Technical, Calm, Southpaw) never need to teach —
their words are self-explanatory.

## Boundaries

- **Pure Coach Runtime.** The lexicon is data + deterministic rendering; no Engine,
  Event, Media, or browser involvement, no randomness, no wall clock.
- **Authored cues stay verbatim.** The lexicon renders the coach's *own* combination
  calls; it never rewrites an authored `instruction`/`reminder`/`correction` cue (those
  are still spoken exactly as the Cue Library wrote them).

## Wiring status

Shipped as a tested capability with per-pack rendering and memory-gated teaching. To
drive it from the live event stream, authored combo cues gain optional punch-number
metadata (`[1,2,6]`) that the Director hands to `renderComboTaught()` — a small,
additive follow-up in `CUE_LIBRARY.md`. Until then the lexicon backs coach-generated
calls and is fully unit-tested (`src/tests/coaching/memory.test.ts`).
