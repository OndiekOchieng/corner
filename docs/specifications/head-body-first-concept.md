<!-- Content / Product Discovery. No runtime, no learning-intent impl, no schema change, no content authored. -->

# Spec — First Concept: HEAD → BODY (content discovery)

| | |
|---|---|
| **Status** | Deferred |
| **Recommendation** | **WRONG FIRST CONCEPT** — head→body is an excellent *athlete* concept and a *poor first test* of the foundation: its defining feature (the level change) is the one thing Corner's model cannot represent, and almost no authored content for it exists |
| **Author** | Discovery (Claude Code) |
| **Date** | 2026-08-11 |
| **Related** | [boxing-curriculum-foundation](boxing-curriculum-foundation.md), [athlete-learning-intent](athlete-learning-intent.md), [BOXING_LEXICON](../coaching/BOXING_LEXICON.md), [ROUND_LIBRARY](../workouts/ROUND_LIBRARY.md), [CUE_LIBRARY](../workouts/CUE_LIBRARY.md), [FIRST_WORKOUT_PACK](../workouts/FIRST_WORKOUT_PACK.md), [QUALITY_CHECKLIST](../workouts/QUALITY_CHECKLIST.md) |

## The central question, answered first

> Can Corner support **HEAD → BODY** as its first honestly supported learning concept, using
> authored boxing content and existing Corner runtime machinery?

**No — and the honest finding is that head→body is the *wrong first concept*.** Not because the
concept is weak (it is one of the truest, most athlete-real focuses in boxing) but because it is
**a level-change concept**, and *level/target is the single thing Corner's content model does not
represent.* A punch is `{number, name, handName}`; a combination is `number[]`. **Nowhere does the
model say whether a shot goes to the head or the body.** Head→body's entire meaning — *throw
upstairs, then drop downstairs* — survives only in free-text cue strings, and is **erased** the
moment the coach's signature machinery (per-pack call-sign rendering) speaks the combination.
Compounding that: there is **near-zero authored head→body content** — 3 tactical body cues, none
implemented in code, and no round that teaches the level change as a skill.

So head→body **stress-tests the foundation's one blind spot** instead of cleanly proving its core
claim (*tag whole rounds · reuse the runtime unchanged · no schema change*). The right move is to
prove the foundation on a concept that lives **entirely inside the existing punch-sequence model**,
and treat head→body as a superb *later* concept that will force an honest, separate question: *does
Corner want to model target/level at all?*

## 1. Definition of HEAD → BODY (Task #1)

**Athlete-facing:** *"Working the body — throwing to the head to bring the guard up, then dropping
a shot downstairs."* Level-changing: high to open, low to hurt.

- **Altitude:** correct as a *session focus* — bigger than one punch, smaller than "boxing." Good.
- **Inside the concept:** high-line punches used as a setup; a deliberate **level change** to a body
  shot (classically cross-to-body, lead hook to the body, uppercut to the body); the discipline of
  *guard-up while changing levels*.
- **Outside the concept:** pure body-conditioning volume ("dig for 3 minutes") — that is *capacity*,
  not the head→body *skill*; and generic pressure/inside fighting.
- **Prerequisites:** a working one-two (the high-line setup). Mild; not a hard gate.
- **What makes a round genuinely exercise it:** a taught *transition* from a head shot to a body
  shot — **not** a round that merely contains the word "body." (See Task #3.)

**The definitional problem, stated plainly:** head→body is defined by *where the punch lands*, and
"where" is exactly what Corner does not model. This is not incidental — it is the whole concept.

## 2. Existing content audit (Task #2)

Ground truth from the repo (`data/seeded-workouts.ts`, `types/workout.ts`, `src/lib/coaching/*`,
and the workout docs):

**The combination model — no target/level.**
```ts
// src/lib/coaching/BoxingLexicon.ts
1:Jab  2:Cross  3:Lead hook  4:Rear hook  5:Lead uppercut  6:Rear uppercut   // number, name, handName — NO target
// types/workout.ts
combination?: number[];   // punch identity only. No `target`, `level`, or `location`.
```
A combination `[1, 2, 6]` = *jab, cross, rear uppercut* — silent on whether any shot is a body shot.
**Body targeting is not representable in structured content; it exists only in free-text `text`.**
(Note: the lexicon's `level: 1–4` is *coach-vocabulary altitude*, not anatomical level — a false
friend.)

**Authored head→body content — almost none.**

| Source | Actual content | Kind |
|---|---|---|
| `FIRST_WORKOUT_PACK.md` — Pressure Fighting R3 | `"Dig to the body."` · `"Hands up while you press."` | tactic (prose spec; **not implemented in code**) |
| `FIRST_WORKOUT_PACK.md` — Fight Conditioning R4 | `"Dig — stay low, stay busy."` | conditioning (prose spec; **not implemented**) |
| `ROUND_LIBRARY.md` — Rear Uppercut | *"the body and the guard-splitter"* | single-punch archetype (mentions the body; not a level change) |
| `ROUND_LIBRARY.md` — Pressure | *"body work inside"* (implied) | tactic |
| `WORKOUT_SCHEMA.md` | `body` is a valid workout **skill tag** | workout-level label, not per-punch target |
| `VOICE_GUIDELINES.md` | *"Round three. Body work."* | a round *focus label* |
| `data/seeded-workouts.ts` | **ZERO** body content. Combos present: `[1,2,3] [1,2] [1,2,3,6] [1,2]` | — |

**Reusable:** the call-sign lexicon, the teach/reinforce/vary runtime, `CoachingMemory`, the round
archetypes, the quality gate. **Merely untagged:** essentially nothing — there is no hidden head→body
content waiting for a tag. **Genuinely missing:** authored rounds and cues that *teach the level
change*. **Not representable:** the head-vs-body distinction itself, in structured data.

## 3. The whole-round test (Task #3)

The whole-round decision from the foundation **holds** — the failure here is not the unit. Applying
the test to today's material:

- **Does any existing round genuinely teach head→body?** **No.** The only body rounds (prose-only)
  teach *body work as a pressure/conditioning tactic* — "dig, stay low, stay busy" — not the
  *technical transition* high→low. A round does not qualify because a cue says "body."
- **Is there variety?** No — 2–3 near-identical "dig to the body" cues. A focused session would loop
  them.
- **Does it need too much speech?** *Yes, dangerously.* Because the level change can't ride in the
  `combination` metadata, teaching it forces the coach to **explain in words** ("jab up top to lift
  the hands, then rip the cross to the body") — longer cues, more talking. That is the opposite of
  the foundation's promise that a focused coach gets **quieter**.

## 4. Teach / reinforce / vary (Task #4)

The runtime's `teach → reinforce → vary` arc is intact and reusable — but it needs *boxing* to point
at, and here there is none. With only 2–3 body cues, "reinforce" degrades into **repetition** (the
runtime varies *wording*, not *boxing*). To get real variation you must author multiple distinct
level-change entries — and each, lacking a target field, must carry its level in verbatim text,
compounding the speech problem. **Minimum useful progression is not reachable from current content.**

## 5. Content depth (Task #5)

The foundation's insight — *depth = variety of boxing, not variety of wording* — is exactly what
sinks head→body here. The runtime already owns wording variety; the **boxing** variety must be
authored, and for head→body that boxing variety is *distinct level-change sequences*, which the model
can't encode and the catalog doesn't contain. Estimated content to reach honest depth: **several new
whole rounds authored from scratch**, each expressing target in text — i.e. *net-new authoring*, not
tagging. That is the opposite of the "reuse, just tag" thesis the first concept was meant to prove.

## 6–10. Gate results

- **Quality gate (Task #6, existing checklist):** **Fails today** — no content to run through it; the
  read-aloud "feels coached" test can't be met by 3 looping cues.
- **Closed-world (Gate 1):** *Passable in principle* — head→body could be an explicitly supported
  concept — but hollow, because supporting it honestly requires content that doesn't exist.
- **Never-diagnose (Gate 2):** **Clean** — nothing here tempts diagnosis; "dig to the body" is a
  universal instruction, not "you're weak to the body." This gate is not the problem.
- **Read-aloud (Task #7):** **Fails** — to teach the level change without a target model, the coach
  must *explain*; explanation is louder, not quieter. And the thin cue set loops. Both are read-aloud
  failures.
- **Athlete experience (Task #8):** predicted failures are the ones the brief names — *"every round
  felt the same," "Corner kept telling me body," "a normal workout with the label changed," "too much
  talking."* Today's content cannot produce *"that head-body started feeling natural."*

## 11. What existing machinery already delivers (Task #13)

Everything except the concept itself: call-sign rendering, teach-through-exposure, reinforcement
memory, round archetypes, the quality gate, whole-round assembly. **The runtime is ready. The
content and the model are not.**

## 12. What is genuinely missing (Task #14)

1. **Authored head→body rounds** that teach the level change as a skill (near-zero today).
2. **A way to express target/level** so the concept survives per-pack call-sign rendering. Today the
   body shot vanishes when `[1,2]` is spoken as *"One-two"* — the concept is silently dropped exactly
   where the coach is at its most characteristic.

Item 2 is the deep finding. **Recommendation only (per the brief's "no new runtime" rule):** *if*
Corner ever commits to body-level concepts, it will face a genuine, tiny schema question — whether
`combination` (or a per-punch shape) should carry `target: 'head' | 'body'` — **and that deserves its
own discovery.** Do **not** decide or build it here. It is precisely the kind of model change the
curriculum-foundation discovery promised a *good* first concept would **not** require — which is the
proof head→body is the wrong first concept.

## 13. Is head→body a good first concept? (Task #9)

**No.** Judged as a *test of the foundation*, a good first concept must (a) be fully expressible in
the existing model, (b) reuse existing authored content by tagging, (c) need no schema change, and
(d) let the coach stay quiet. Head→body fails (a), (b), (c), and (d). It is a *great third concept* —
once the target/level question is honestly settled — but a poor first one. It is valuable precisely
because it **exposed a foundation blind spot early**, which is a successful discovery outcome.

## 14. Recommendation

**Pick a different first concept — one that lives entirely inside the punch-sequence model — and
prove the foundation there.** The cleanest candidate is a **combination concept the catalog already
contains**: e.g. **"the one-two"** (or *finishing combinations*), which the seeded workouts already
author as `[1,2]`, `[1,2,3]`, `[1,2,3,6]` with real cues, and which the lexicon renders **honestly**
across all six packs with **no schema change and no new speech**. That concept is the true test of
*tag whole rounds · reuse the runtime · stay quiet* — the thing head→body was meant to prove but
can't. (Final concept choice is the maintainer's; this only shows head→body isn't it.)

Keep head→body on the roadmap as the concept that *earns* the target/level discussion — later, and on
its own terms.

## 15. Non-goals (unchanged)

No runtime, no learning-intent implementation, no concept selector, no schema change, no new engine,
no AI generation, no combo generator, no content authored here. This discovery **builds nothing** and
**authors nothing** — it reports what is on disk and what it means.

## 16. Open questions

- For a *combinations* first concept, how many whole authored rounds give honest variety before
  reinforcement reads as repetition? (The clean test to run next.)
- Should the eventual target/level question be a **schema** change (`target` on a punch) or stay
  **text-only** forever (accepting that body work can't use call-sign rendering)? (Its own discovery.)
- Is there a coarser honest "body work" concept (tactic/conditioning, text-only, no call signs) that
  is worth supporting *without* solving level-change — or does that betray the crisp "head→body"
  athletes actually mean?

## Verdict

**WRONG FIRST CONCEPT** (head→body itself: **NOT YET**). Head→body is one of the most athlete-true
focuses in the sport and a **poor first proof** of the curriculum foundation: its defining feature is
a level change Corner's model cannot represent, its call-sign rendering silently drops the body shot,
it forces a *louder* coach, and almost none of it is authored. It stress-tests the foundation's blind
spot rather than demonstrating its core claim. **Prove the foundation on a pure punch-sequence concept
first; return to head→body when Corner is ready to answer, honestly and separately, whether it models
where a punch lands.** The system should disappear and the boxing should remain — and today, for
head→body, the boxing hasn't been authored and the model can't hold it.

*No code, no schema, no content authored. The deliverable is understanding.*
