<!-- Product & Experience / Discovery Specification. Discovery, not implementation. No code, no architecture, no content authoring. -->

# Spec — The Boxing Curriculum Foundation

| | |
|---|---|
| **Status** | Deferred |
| **Recommendation** | **PARTIALLY** — the foundation is real, worth defining, and *mostly already exists*; the honest smallest version is far smaller than the five-layer model implies, and the tempting large version (taxonomy + graph + adaptive assembly engine) is *not* Corner |
| **Author** | Discovery (Claude Code) |
| **Date** | 2026-08-11 |
| **Related** | [athlete-learning-intent](athlete-learning-intent.md) (the NOT YET this unblocks), [THE_COACH](../coaching/THE_COACH.md), [BOXING_LEXICON](../coaching/BOXING_LEXICON.md), [COACHING_MEMORY](../coaching/COACHING_MEMORY.md), [WORKOUT_DESIGN](../product/WORKOUT_DESIGN.md), [PROGRESSION_MODEL](../workouts/PROGRESSION_MODEL.md), [ROUND_LIBRARY](../workouts/ROUND_LIBRARY.md), [CUE_LIBRARY](../workouts/CUE_LIBRARY.md), [QUALITY_CHECKLIST](../workouts/QUALITY_CHECKLIST.md) |

## The central question, answered first

> What is the smallest authored boxing foundation that lets Corner honestly say *"Yes, I can help
> you learn X"* — and then deliver a coherent focused session?

**PARTIALLY — and we were half-asking the wrong question.** The foundation is real and worth
defining; [Athlete Learning Intent](athlete-learning-intent.md) genuinely rests on it. But the
answer is not *"build a knowledge system."* On inspection, **four of the proposed five layers
already exist in Corner** — as prose, authored content, and schema — and the tempting versions of
the missing pieces (a formal concept **graph**, an **adaptive assembly engine**, an inferred
taxonomy) are exactly the over-engineering Corner must refuse. The honest smallest foundation is
**one genuinely-new authored layer** — a tiny **closed vocabulary of learnable concepts** and
**concept-tags on existing whole rounds** — plus **one small honesty extension** to the quality
gate. Everything else is *renaming or hardening what is already here.*

The half-wrong question is the verb: **"what must Corner *know*?"** Corner must *know* nothing.
Boxing knowledge lives in **human authoring**; Corner only **selects** authored content it is
*told* is honest. A foundation that makes Corner *reason over boxing as data* is a different, non-
Corner product. The right question is **"what must be *authored*, and where is the honest edge?"**

## 1. The problem — why this exists

[PR #15 — Athlete Learning Intent](athlete-learning-intent.md) reached **NOT YET** behind one
gate: *Corner may only accept "I want to learn X" when it can honestly back that promise with
authored boxing knowledge.* This discovery puts that gate on trial — is the five-layer foundation
the right model, what is load-bearing, and what is the smallest thing that makes the promise
honest?

## 2. The athlete need

The athlete wants to name a thing they care about — *head-body, feints, exits* — and have a real,
coherent session honour it, **without designing anything and without thinking about Corner while
they box.** The need is for *honest focus*, not for a curriculum, an AI, or a knowledge base.

## 3. The honesty principle (non-negotiable)

Corner may never imply *"I can teach you X"* it cannot support. The trust chain:

```
   AUTHORITATIVE BOXING KNOWLEDGE  (human authors — the only source of truth)
            ↓  authored, never generated
   CONCEPT-TAGGED AUTHORED CONTENT (whole rounds, quality-gated)
            ↓  selected, never invented
   COHERENT FOCUSED SESSION        (assembled by existing authoring judgement)
            ↓  coached, never narrated
   HONEST COACHING                 (the coach says less because it knows the focus)
```

If any link is missing, the only honest output is **"Not that — yet."** Never improvise, fabricate,
diagnose, or generate unsupported boxing. **A refusal is a successful outcome.**

## 4. Current-state audit — what Corner already has

A full audit (BOXING_LEXICON, COACHING_MEMORY, WORKOUT_DESIGN, WORKOUT_SCHEMA, ROUND_LIBRARY,
CUE_LIBRARY, QUALITY_CHECKLIST, PROGRESSION_MODEL, the TypeScript types, `src/lib/coaching/*`, and
the seeded workouts) shows the ground is far from bare:

| Foundation piece | What already exists | Strength |
|---|---|---|
| Boxing **atoms** | 6 call signs `[1..6]`; combinations as `number[]` on a cue's `combination`; per-pack rendering via `BoxingLexicon` | **Solid** — the atoms and their language are done |
| **Teaching mechanism** | teach-through-exposure (first encounter both forms → shorthand); `introducedCallSigns` | **Solid** |
| **Reinforcement mechanism** | `CoachingMemory` — reinforcement pools, `recentTexts` (never identical wording), `reinforcementCounts`, deterministic rotations | **Solid** — variety-of-*wording* is already owned by the runtime |
| A concept-like **vocabulary** | `dimensions` (guard, distance, footwork, breathing, rhythm, power, head, output, general); 11 cue categories; 16 round archetypes; 6 workout types; controlled `tags` | **Partial** — exists, but **inferred from cue text at runtime**, and none is an *athlete-facing "thing I can learn."* |
| Concept-**tagged content** | cue `kind` + `combination` metadata; round `archetype`; workout `objective`/`focus`/`tags` | **Weak** — content is classified by *regex on text*, not *authored* as "this round teaches X" |
| Concept **relationships** | `PROGRESSION_MODEL §6` complexity ladder; the spiral (introduce→drill→combine→pressure); workout `prerequisites` + `progressionNext` | **Partial** — real, but as **prose + workout-level arrays**, not a concept graph (and that's fine) |
| Session-**assembly grammar** | `WORKOUT_DESIGN` (arc), `ROUND_LIBRARY` composition rules, `PROGRESSION_MODEL` (one axis at a time), cue placement | **Strong (as authoring)** — lives in the author's judgement + docs, not a runtime DSL |
| **Quality bar** | `QUALITY_CHECKLIST` (23 checks + blockers), schema validation, the read-aloud test | **Strong** — but has no *closed-world* or *never-diagnose-from-intent* rule |

**The headline:** the coaching *machinery* (teach, reinforce, vary, render) is complete; what is
missing is a thin **authored layer that names what an athlete can learn and points existing
content at it** — plus an honesty rule at the edge. This is *authoring*, not a new system.

## 5. Five-layer assessment — right in spirit, wrong in weight

Validated against the audit. **Do not build all five. Two are load-bearing; two already exist and
must not be rebuilt; one needs only a small extension.**

| Layer | Verdict | Why |
|---|---|---|
| **1 — Concept vocabulary** | **KEEP — load-bearing, genuinely new** | An athlete-facing *closed, curated* set of learnable concepts. Corner has proxies (dimensions/tags) but none an athlete would *pick*. This is the real gap. |
| **2 — Concept-tagged content** | **KEEP — load-bearing, genuinely new** | Authored tags ("this whole round teaches head-body") replacing runtime regex inference. The other real gap. |
| **3 — Relationship graph** | **TRIM — mostly exists; do NOT build a graph** | Prerequisites + the complexity ladder already encode relationships. A formal queryable graph is *"graphs are interesting"* over-engineering. Keep relationships *implicit in authored rounds and the existing `prerequisites` field.* |
| **4 — Session-assembly grammar** | **REUSE — already exists as authoring; do NOT build a DSL** | `WORKOUT_DESIGN` + `ROUND_LIBRARY` + `PROGRESSION_MODEL` already are the grammar. V1 assembles from **whole authored rounds tagged to the focus** — *selection*, not generation. No engine. |
| **5 — Confidence boundary + quality bar** | **EXTEND — keep, add two rules** | The `QUALITY_CHECKLIST` is strong; add a **closed-world** gate and a **never-diagnose-from-intent** gate. A small amendment, not a redesign. |

So the five collapse to: **two new authored things (1, 2), one honesty amendment (5), and two
"leave it alone, it already works" (3, 4).**

## 6. Ownership model — complete, with one addition

Preserving [THE_COACH](../coaching/THE_COACH.md)'s ownership discovery:

```
ATHLETE   →  what do I want to learn?          (picks a focus; never designs)
CONTENT   →  what can Corner honestly teach?    (authored boxing — the closed set)
CORNER    →  when / how is it structured?       (selects & sequences authored rounds)
COACH     →  how is it delivered?               (the relationship; says less, knows the focus)
ATHLETE   →  did I actually learn something?    (the only verdict that matters)
```

**The one missing owner: the *honest edge itself.*** Who decides a concept is "supported"? Not the
runtime (it must infer nothing) and not the coach (it must never invent boxing). It is owned by
**authoring governance — humans** — via the quality gate. Corner *reads* the closed set; it never
*grows* it. That addition is what keeps *content → never becomes the Coach*, *Coach → never invents
boxing*, and *Corner → never diagnoses the athlete* all true at once.

## 7. Content model recommendation

**Whole authored rounds, tagged to a concept — nothing smaller becomes a first-class object.**

- The unit of supported content is the **whole round** (already the safe, authored unit). Corner
  **selects and sequences** rounds; it never assembles fragments or generates combinations.
- A concept tag is **authored metadata on a round** ("this round *teaches* head-body"), replacing
  today's runtime regex dimension-inference for the *learning-intent* path. Existing cues,
  combinations, and reinforcement pools are reused unchanged.
- **One round may teach more than one concept** (a counter round teaches *counters* and *defense*);
  a concept is supported by *several* rounds. Tags are many-to-many, authored, and small.
- **"Enough content" is bounded by variety-of-*boxing*, not variety-of-*wording*** — because the
  runtime already guarantees fresh wording (`recentTexts`, reinforcement pools). So a concept needs
  only enough authored *rounds/entries* that the **boxing** doesn't repeat across a focused session
  — materially less content than it first appears.

## 8. Vocabulary recommendation — the smallest closed world

- **A tiny, closed, curated, athlete-facing set** — on the order of **~5 concepts** for V1, not a
  taxonomy. Examples (illustrative, not final): *head→body · body→head · feints · exits after
  combinations · counters.*
- **What makes something a learnable concept:** it is (a) a real coachable boxing unit a human
  coach would name, (b) at the **altitude of a session focus** — bigger than a single punch, smaller
  than "boxing," (c) teachable **hands-free without the coach getting louder**, and (d) backed by
  enough authored rounds to fill a focused session without repeating. If any fails → not a concept
  yet.
- **Altitude test:** too broad = *"boxing"*, *"offense"* (can't shape a session). Too granular =
  *"the jab-retraction angle"* (the coach can't teach it without over-talking; ten flavors of jab =
  paralysis). Right = *"head→body"*.
- **Owned by authoring governance;** it **evolves only** by a human authoring the content and
  passing the gate — never by inference, never at runtime. **The vocabulary IS the promise:** if
  it's not in the set, Corner cannot offer it.
- **Outside the set:** in the honest V1 the athlete *picks from the set*, so **"outside" is
  unreachable by construction** — you cannot request what is not offered (see §16).

## 9. Relationship recommendation — do not build a graph

**No explicit concept graph at V1.** The relationships that matter are already covered:

- **Prerequisites** — reuse the existing workout-level `prerequisites`; most V1 concepts (head-body,
  feints) are honestly teachable *standalone* and need none.
- **Composability / sequence** — stays **implicit in authored whole rounds** (the author decides a
  round enters with a feint) and in the `PROGRESSION_MODEL` complexity ladder. Corner never composes
  concepts at runtime — that is the deferred `connect` from PR #15.
- A queryable graph, `composable-with`/`contrasts-with` edges, a skill tree — **rejected as
  over-engineering.** Build one only if a concrete need ever proves an authored round can't express
  the relationship. None does today.

## 10. Session-assembly recommendation — selection, not a DSL

- **Assemble a focused session by selecting whole authored rounds tagged to the focus**, ordered by
  the **existing** grammar (`WORKOUT_DESIGN` arc; `ROUND_LIBRARY` order: develop → layer → pressure →
  recover; `PROGRESSION_MODEL` *one axis at a time*).
- The `teach → reinforce → vary` arc is **validated and already lives in the runtime** within a
  session. `connect` and `apply/test` are **rejected for V1** (cross-session + assessment — PR #15's
  deferred scope). So the hypothesis becomes: **teach → reinforce → vary**, full stop.
- **Focus vs. surround:** a focused session is a *real workout that emphasizes* the concept, not
  100% drilling it — warmup, arc, and close stay intact; the focus concentrates the *work* rounds.
- **The coach gets quieter, not busier:** knowing the focus lets it *say less* (PR #15 §7). A session
  that talks *more* to "teach the concept" has already failed.
- **No assembly engine, no template.** *"A relationship is not a template"* — if assembly becomes a
  fill-in-the-blanks generator, it breaks THE_COACH.

## 11. The confidence boundary

- **Closed world:** Corner offers *only* authored, gated concepts. The pick-from-set input model
  makes this **structurally honest** — there is no free-text path to fabricate against.
- **Never diagnose:** an athlete goal phrased as a problem (*"I get caught after combos"*) may, at
  most, map to an *offered concept* — never to a claim *"your weakness is X."* Corner can't see the
  athlete. (In V1 this doesn't arise: the athlete picks a concept, not describes a problem.)
- **Never generate unsupported boxing:** the runtime invents no combinations, techniques, tactics,
  or coaching claims. It *selects* authored rounds; full stop.

## 12. The quality bar

The existing `QUALITY_CHECKLIST` (23 checks + blockers + read-aloud test) is **sufficient for the
boxing itself** and must not be silently redesigned. Add **two concept-level gates** before a
concept is marked *supported*:

1. **Closed-world honesty** — *"Is every offered concept backed by enough gated content to fill a
   focused session without repeating the boxing? If not, it is not offered."* (BLOCKER)
2. **Focus stays quiet** — *"Read a full focused session aloud: does the coach teach the concept by
   saying **less**, never by narrating the focus or over-talking?"* (BLOCKER — extends the existing
   read-aloud test)

Technical soundness, safety, no-shame, no-see-the-athlete, and no-app-speak are **already** blockers
in the checklist and carry over unchanged.

## 13. Authoring implications — what a human must actually produce

Per concept, realistically:

```
Concept name (athlete-facing)
   → one-sentence definition (what it is, as a focus)
   → a small set of WHOLE authored rounds tagged to it (reusing existing cues/combinations)
   → (optional) prerequisites — only if honestly required
   → quality review: technical soundness + safety + closed-world + focus-stays-quiet
   → SUPPORTED  (or:  "Not that — yet.")
```

This is the **existing workout-authoring process** (`AUTHORING_GUIDE` + `QUALITY_CHECKLIST`) with a
*concept tag* and *two extra review questions* — **not** a new authoring tool, CMS, or editor
(those are explicit non-goals). We are determining *what must exist*, not building the means to make
it.

## 14. The smallest supported concept — worked example: HEAD → BODY

Before Corner may say *"Yes, I can help you work on head→body,"* the **minimum** is:

| Required | Verdict | Why |
|---|---|---|
| A one-sentence **definition** | **Yes** | The concept must be nameable and bounded |
| A small set of **whole authored rounds** tagged to it | **Yes** | Enough that the *boxing* doesn't repeat across a focused session (est. a few rounds — the runtime owns wording variety, so fewer than intuition suggests) |
| **Coaching cues** | **Reuse** | The `CUE_LIBRARY` + reinforcement pools already cover the wording |
| **Variations** | **Reuse** | Provided by the runtime's reinforcement/rotation, plus different authored entries |
| **Quality approval** | **Yes** (BLOCKER) | Technical soundness + safety + the two new concept gates |
| Distinct entry/exit objects | **No** | Encoded *inside* the authored rounds, not as separate first-class data |
| **Multiple standalone combinations** as objects | **No** | Fragments are a non-goal; combinations live inside whole rounds |
| **Relationship metadata / prerequisites** | **No** (optional) | Head-body is honestly teachable standalone |
| Reinforcement material (new) | **No** | Already exists in `COACHING_MEMORY` |

**Minimum supported concept = definition + a few authored whole rounds tagged to it + passing the
extended quality gate.** Nothing more. That is the honest floor.

## 15. The V1 foundation — the smallest thing that flips PR #15 to YES

1. **A closed vocabulary of ~5 concepts** (athlete-facing, curated, human-owned).
2. **Concept tags on whole authored rounds** — enough rounds per concept to fill a focused session
   without repeating the boxing (mostly *tagging and modest new authoring* over existing content).
3. **Two new gates in the `QUALITY_CHECKLIST`** — closed-world honesty + focus-stays-quiet.
4. **Reuse, unchanged:** the runtime (teach/reinforce/vary), `BoxingLexicon`, `CoachingMemory`,
   `ROUND_LIBRARY`, `WORKOUT_DESIGN`, `PROGRESSION_MODEL`, `prerequisites`.

**Not** the whole curriculum, **not** every concept, **not** a graph, **not** an engine — *just
enough authored foundation to support the first honest concept.* When this exists (and a focus-aware
quieter coach — PR #15 §15's second gate), Athlete Learning Intent becomes a small, boring,
beautiful **YES**.

## 16. The "Not that — yet" experience

In the honest V1 the athlete **picks from the curated set**, so a request outside the vocabulary is
**unreachable by construction** — there is no free-text to refuse. The confidence boundary is
enforced by the *input model itself*, not by a refusal dialog. A spoken/most-of-UI "Not that — yet"
only becomes necessary **if** free-text or problem-input is ever added (PR #15's **NO**). Finding:
*the pick-from-curated input model is what makes the closed world trivially honest* — one more
reason it is the right V1. (No UI is designed here.)

## 17. Non-goals

Concept **graph** / skill tree · adaptive **assembly engine** or DSL · runtime **inference** of
concepts · **AI generation** of combinations or curricula · combo **builder/editor** · content
**CMS** or authoring tool · **cross-session** curriculum, profiles, progress, scoring, achievements
· formal **testing/assessment** · new coach **personalities** · any new **runtime/manager/service/
engine/persistence** · implementing learning intent, concept selection, or persistence. This
discovery **authors nothing** and **builds nothing.**

## 18. Open questions

- How many concepts is *few enough* to stay boring and *many enough* to feel real? (Hypothesis: ~5
  for V1; a UAT question.)
- What is the true minimum *round count* per concept before reinforcement reads as repetition —
  given the runtime already varies wording? (Author + UAT.)
- Does *"the coach says less because it knows the focus"* read as **more coached** or as
  **neglected**? (Inherited from PR #15 — still the crux.)
- Is a single concept ever honestly teachable in *one* whole round, or is a small set always
  required for a session-length focus?
- Who, concretely, holds authoring governance — and what is the lightest credible two-person review?

## 19. Risks — how this fails even if built correctly

- **Vocabulary too broad** → concepts too vague to coach; sessions unfocused.
- **Concepts too granular** → athlete paralysis; the coach must over-talk to teach a hair-thin idea
  (silence broken).
- **Too little authored content** → the *boxing* repeats; reinforcement becomes repetition.
- **Assembly becomes a template** → formulaic sessions; *"a relationship is not a template"* broken.
- **A concept marked supported without real content** → Corner claims more than it knows — the core
  honesty failure.
- **The graph/engine gets built anyway** → complexity for its own sake; a knowledge *system* the
  athlete can feel.
- **Learning intent degrades into a workout selector** → PR #15 explicitly said picking a concept ≠
  picking a pre-built workout.
- **The deepest failure:** the foundation is built *perfectly* and the athlete *perceives the
  machinery* — thinks *"Corner has a curriculum"* instead of *"I'm working my head-body."* The
  foundation succeeds only when it is **invisible** — authored depth felt as good boxing, never as a
  system experienced. *Forget the phone; remember the boxing.*

## 20. Recommendation

**Affirm the foundation, trim it hard, and keep it authoring.** Define the smallest honest version —
a **closed ~5-concept vocabulary**, **concept-tags on whole authored rounds**, and **two honesty
gates** on the existing quality checklist — and **reject** the graph, the assembly engine, and any
runtime inference or generation. The next concrete step (its own work, not this discovery) is a
**content discovery**: author and gate the *first* supported concept end-to-end (head→body is the
worked candidate) and prove — via read-aloud and UAT — that a focused session *feels* like learning
while the coach gets *quieter*. One honest concept is worth more than a taxonomy.

## Verdict

**PARTIALLY — with a corrected question.** The Boxing Curriculum Foundation is a real and worthy
gate, and it is **closer than it looked**: four of the five proposed layers already exist in Corner,
and the honest smallest foundation is **two authored things and one honesty amendment**, not a
knowledge system. The five-layer model was right to name the trust chain and wrong to imply five new
builds; the graph and the assembly engine are *not* Corner. And the framing itself needed
correcting: **Corner must not *know* boxing — humans author it, tag it, gate it, and Corner only
selects what it is told is honest.** So: **PARTIALLY buildable, mostly already built, deliberately
kept small** — and PR #15 stays **NOT YET** only until the first concept is authored and gated to the
new bar. Affirm the foundation, refuse the system, author one honest concept, and the door to
Athlete Learning Intent opens.

*No code, no architecture, no content authored. The deliverable is understanding.*

---

## Answers to the 18 questions

1. **Is the five-layer model correct?** Partially — right on the trust chain, wrong on weight. Two
   layers are load-bearing and new (vocabulary, tagged content); two already exist (relationships,
   assembly); one needs only a small extension (quality/boundary).
2. **What is missing?** An athlete-facing **closed concept vocabulary** and **authored concept-tags
   on whole rounds** — plus a closed-world/never-diagnose honesty gate.
3. **What is unnecessary?** A formal concept **graph**, an **adaptive assembly engine/DSL**, runtime
   concept **inference**, and any **generation**.
4. **What is the smallest closed vocabulary?** ~5 curated, athlete-facing concepts (e.g. head-body,
   body-head, feints, exits, counters) — human-owned, evolves only by authoring + gate.
5. **What qualifies as a supported concept?** A definition + enough gated whole rounds to fill a
   focused session without repeating the boxing + passing the extended quality bar.
6. **What authored content is required per concept?** A one-sentence definition and a small set of
   whole authored rounds tagged to it; cues/variation are reused from existing libraries + runtime.
7. **Does Corner need an explicit relationship graph?** **No.** Prerequisites (existing) + the
   complexity ladder + relationships implicit in authored rounds suffice for V1.
8. **What is the minimum session-assembly grammar?** The one that already exists — select whole
   tagged rounds; order by `WORKOUT_DESIGN`/`ROUND_LIBRARY`/`PROGRESSION_MODEL`; teach→reinforce→vary.
   No new grammar.
9. **What existing systems provide this?** Atoms + rendering (BOXING_LEXICON), teach/reinforce/vary
   (COACHING_MEMORY), assembly grammar (WORKOUT_DESIGN/ROUND_LIBRARY/PROGRESSION_MODEL), quality bar
   (QUALITY_CHECKLIST), relationships (`prerequisites`).
10. **What is the confidence boundary?** Closed world (offer only gated concepts) · never diagnose ·
    never generate — with the pick-from-set input making the closed world structurally honest.
11. **What is the quality bar?** The existing 23-check checklist + read-aloud test, plus two new
    blockers: closed-world honesty and focus-stays-quiet.
12. **Who owns the boxing knowledge?** Human **authors**, gated by **authoring governance.** Corner
    holds no knowledge; it selects authored content it is told is honest.
13. **What does a human author create?** Concept name → definition → a few tagged whole rounds →
    (optional) prerequisites → quality review → supported. The existing process + a tag + two
    questions.
14. **What is the minimum viable supported concept?** Definition + a few authored whole rounds tagged
    to it + passing the extended gate. (Worked for head→body in §14.)
15. **What happens outside the supported vocabulary?** In V1, nothing to handle — the athlete picks
    from the set, so "outside" is unreachable. Refusal only matters if free-text is ever added.
16. **What makes the eventual Learning Intent trustworthy?** Every offered concept is really
    authored, technically sound, and coachable *quietly*; Corner infers and generates nothing; the
    session feels like boxing, not a curriculum.
17. **What makes it dishonest?** Offering a concept without real content; generating boxing;
    inferring intent; diagnosing the athlete; the coach narrating or over-talking the focus.
18. **What is the smallest foundation that moves PR #15 from NOT YET to YES?** §15: a closed
    ~5-concept vocabulary + concept-tags on whole authored rounds + two quality gates — reusing the
    runtime unchanged. Plus PR #15's own second gate (a focus-aware quieter coach).

---

## The final test (applied)

> Before Corner says *"I can help you learn X"*: Is X defined? Authored? Technically sound? Enough
> content? Can we assemble a coherent session? Can the coach reinforce it without becoming the
> protagonist? Can Corner stay inside what it actually knows? Can the athlete forget Corner and
> remember the boxing?

Today, for every X: **several answers are NO** — nothing is authored *as a concept*, no closed
vocabulary exists, no round is *tagged*. So the honest answer today is **"Not that — yet."** This
discovery defines the *smallest* set of authored YESes that changes that — and refuses everything
that would make Corner louder, cleverer, or less honest on the way.

> The athlete is the north star · the Coach exists for the athlete · content owns boxing knowledge ·
> the Coach owns the relationship · Corner owns time and structure · never generate what we have not
> authored · never claim what we cannot support. **Forget the phone. Remember the boxing. Box first,
> engineer later.**
