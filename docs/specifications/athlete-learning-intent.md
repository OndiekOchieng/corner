<!-- Product & Experience Specification. Discovery, not implementation. No code, no architecture. -->

# Spec — Athlete Learning Intent

| | |
|---|---|
| **Status** | Deferred |
| **Recommendation** | **NOT YET** — the principle is pure Corner; the foundation to build it honestly does not exist, and every tempting shortcut is *not* Corner |
| **Author** | Discovery (Claude Code) |
| **Date** | 2026-07-22 |
| **Related** | [THE_COACH](../coaching/THE_COACH.md), [COACHING_DOCTRINE](../coaching/COACHING_DOCTRINE.md), [PERSONALITY_SYSTEM](../coaching/PERSONALITY_SYSTEM.md), [BOXING_LEXICON](../coaching/BOXING_LEXICON.md), [PHILOSOPHY_REFRESH](../PHILOSOPHY_REFRESH.md) |

## The final question, answered first

> Can an athlete tell Corner *"this is what I want to learn,"* and then forget about Corner
> while Corner quietly helps them get better at it?

**NOT YET — but this is the most Corner idea we have discovered.** The athlete owning *what they
want to learn* is the purest possible expression of *the athlete is the north star*. What is
missing is not the idea — it is the **foundation**: Corner has nothing authored to *point* the
intent at, and the versions that look easy (AI generation, natural-language inference,
cross-session curricula, testing/scoring) are each, on inspection, **not Corner**. Right idea;
wrong time; and a few of its cousins are the wrong idea entirely.

## 1. The problem

The athlete already knows what they need: *"I keep getting caught after combinations."* *"I want
to use feints before I enter."* Corner knows how to *execute* a session but gives the athlete no
way to say *"this is what I'm trying to learn"* — so the athlete must find or build a workout
that happens to teach it. The intent — the athlete's own goal — is the one thing Corner cannot
currently hear.

## 2. The athlete need

To **express a learning goal** and have the session honour it — *without becoming the workout
designer, and without Corner making them think about Corner while they box.* The need is real
and athlete-first. It is *not* a need for AI, novelty, or a curriculum engine.

## 3. Recommendation — NOT YET (with a NO and a small latent YES)

Three layers, because the ask contains three different things:

- **YES — the principle.** *The athlete owns what they want to learn.* This belongs in Corner;
  it is the north star made concrete. Affirm it.
- **NOT YET — the honest V1** (see §5–§6): a session built from **existing, authored,
  concept-tagged content**, pointed at a focus the athlete *picks from a curated set*, with the
  coach saying **less** because it knows the focus. Corner-aligned in spirit, but it needs a
  content foundation that does not exist yet (concept-tagged authored boxing) and a coach that
  *uses* the focus to be quieter. Right idea, wrong time.
- **NO — the exciting version.** Natural-language intent → AI-generated adaptive combinations →
  cross-session curriculum → testing/scoring. Each piece violates a Corner invariant (below).
  This is *not* Corner, and building it because it is exciting is exactly what governance forbids.

## 4. What "learning intent" *is* in Corner (definition)

> **Learning intent is the athlete naming what they want to get better at — and nothing more.**
> It is the athlete's half of the relationship (*what*); the Coach owns *how* they are coached
> through it; Corner owns *when* and the structure around it. It is a **focus**, not a
> specification. The athlete points; Corner and the Coach do the work; the athlete never designs.

Crucially, intent is **invisible during boxing.** Its only felt effect is a *more focused
session and a quieter, more targeted coach.* The athlete experiences *"I'm working on my
head-body,"* never *"Corner is adapting my curriculum."* That distinction is load-bearing.

## 5. The smallest useful input model (§4/§5 of the brief)

**A small curated set of named learning focuses the athlete picks from — not natural language,
not a combo builder, not structured data.**

| Candidate input | Verdict |
|---|---|
| A curated **concept/focus** ("head-body", "feints", "exits", "angles", "counters") — picked | **YES (smallest)** — no inference, maps to authored content, athlete points not designs |
| A **combination** ("jab, cross, lead hook") entered | No — that is the athlete becoming the designer; and it is combo-builder work, a non-goal |
| **Natural language** ("teach me to feint before the jab") | No — requires *inference*; the moment Corner guesses wrong it reinforces the wrong thing and breaks trust (a §14 failure) |
| A **weakness/problem** ("I get caught after combos") | Future — this is a diagnosis, and Corner must never claim to see the athlete; it can't confirm the weakness |
| Structured technical data | No — designer work; not athlete-first |

**Why curated concepts win:** Corner must never infer what it cannot confidently understand
(§brief). A picked focus is *unambiguous* — no NLP, no misunderstanding, no false confidence. The
athlete owns the *what* by choosing; Corner owns the *how* by mapping it to authored boxing.
Corner should infer **nothing.**

## 6. The reinforcement model (§6/§7 of the brief)

Corner **already has** most of this — and it is authoring + the coach's existing memory, not a
new engine:

- **Teach** — the coach's existing *teach-through-exposure* ([BOXING_LEXICON](../coaching/BOXING_LEXICON.md)):
  first encounter says both forms, later ones use shorthand.
- **Reinforce** — the coach's existing *reinforcement memory* ([COACHING_MEMORY](../coaching/COACHING_MEMORY.md)):
  the same concept returns in fresh words, never a loop.
- **Vary** — authored rounds present the concept from different entries (authoring, not
  generation).
- **Recall / mild test** — *already emergent*: as the session goes on the coach says **less**
  (shorthand), which *is* reduced instruction — the athlete recalling instead of being told.

So the hypothesis `teach → reinforce → vary → (recall)` is **largely correct and already lives in
the coaching runtime — WITHIN a session.** What it lacks is a *focus to be pointed at.*

**`connect` and formal `test`** (combine with other learned material; assess) are **out of V1** —
they require cross-session memory (a curriculum) and assessment/scoring (a non-goal). They belong
to a future *curriculum* capability, not here.

## 7. The Coach's role (§the brief)

The Coach owns **how**. Given a focus, the Coach teaches and reinforces *that concept* through its
relationship — and, decisively, **says less because it knows what the athlete is working on.**
Learning intent, done right, makes Corner **quieter**, not louder. The Coach must never:

- announce the intent ("today we work your head-body goal") → that is the Coach becoming a
  **narrator / protagonist** (§brief, forbidden);
- explain the learning → that is information over behaviour, and speech over silence;
- become a prompt generator → *"a relationship is not a template"* ([THE_COACH](../coaching/THE_COACH.md)).

## 8. The athlete's role

`Athlete provides intent → Corner assembles the session → Coach adapts the coaching.` The athlete
**expresses** intent by *picking a focus* and **never becomes the workout designer.** The moment
the experience asks the athlete to build combinations or structure rounds, it has failed the
athlete-first test.

## 9. The boundaries of Corner's responsibility (§9/§10/§11)

- **Corner owns:** time, structure, continuity, orchestration — *selecting and sequencing
  authored content* for the chosen focus. Corner **assembles from authored boxing; it never
  generates boxing.** (The intelligence is in the human authoring, not in runtime generation —
  consistent with *content owns coaching; the Coach owns judgement*.)
- **Must remain invariant (every coach, every session):** the athlete is the north star · the
  Coach never stops coaching · silence is coaching · never claim to see the athlete · never the
  protagonist · the correct boxing is identical across coaches · forget the phone.
- **May vary:** *how* a coach teaches the concept (pressure / calm repetition / precision) — that
  is the **relationship**, not the concept. The concept ("head-body") is universal; the teaching
  of it is the coach's. **Learning intent is orthogonal to personality** — the *what* is
  Corner/content, the *how-of-this-concept* is the coach.

## 10. Persistence & memory implications (§12)

- **V1 is session-level only.** Intent lives for one workout, in memory, exactly like the coach's
  existing per-session memory (which resets each workout). **No persistence, no athlete profile,
  no Workout History** — those are separate NOT-YETs.
- **Remember (in-session):** the chosen focus; what the coach has introduced (already tracked).
- **Deliberately do NOT remember:** cross-session curriculum, what the athlete "struggled with"
  (Corner can't see them), progress/scores, an athlete profile. Cross-session reinforcement
  ("bring it back next time") is the boundary between *session intent* (V1) and a *persistent
  curriculum* (future) — and it must not be crossed here.

## 11. Success criteria (§13) — the athlete's experience, not software

The athlete finishes **knowing what they worked on, having actually practised it, having met
variation, and more able to apply it without being told** — and **never thought about Corner.**
The one question every Corner change must pass:

> Can Corner make me better at something I explicitly care about **without making me think about
> Corner while I am boxing?**

Success is **not** generated-combination count, cue count, adaptation count, AI sophistication, or
personalization. A quiet, focused session the athlete forgets Corner ran *is* the success.

## 12. Failure criteria (§14) — how it fails even if the code is correct

- The Coach **talks more** to "teach the learning" → silence broken.
- The Coach **announces the intent** → narrator / protagonist.
- The athlete **can't tell what they learned** → the whole point missed.
- Auto-**assembled boxing is technically poor** → trust broken (argues against generation).
- **Reinforcement becomes repetition**, or reinforces the **wrong thing** (inference error →
  argues against natural language).
- The athlete becomes the **workout designer** → athlete-first violated.
- The athlete becomes **dependent** on Corner's instructions → learning didn't transfer.
- Corner **optimises novelty** instead of learning → *smart* misdefined.
- Corner gives advice **outside what it can confidently understand** → argues against
  weakness/NLP input, and for a curated set.

Every failure mode points the same way: **curated focus (not NLP), authored content (not
generation), a quieter coach (not louder), session-scope (not curriculum).**

## 13. Non-goals

Custom workouts · combo builders · combo libraries · AI-generated combinations · persistent
curricula · athlete profiles · analytics · progress/scoring · achievements · Workout History ·
new coach personalities/relationships · any new runtime/manager/service/engine/persistence.

## 14. Options considered

| Option | Verdict |
|---|---|
| **Do nothing** | Safe, but leaves a real athlete-first gap (the athlete can't name their goal) |
| **Natural-language intent + AI-generated adaptive curriculum + testing** | **NO** — violates silence, coach-not-protagonist, athlete-not-designer, no-inference, success-not-sophistication; optimises novelty; risks poor boxing |
| **Curated focus → assemble authored, concept-tagged content → focus-aware quieter coach (session-scope)** | **The honest V1 — but NOT YET**: needs concept-tagged authored content that doesn't exist, plus a coach that uses the focus to say less |
| **Just let the athlete pick a workout by what it teaches** | Small and buildable, but the brief explicitly says this is *not* the idea (selecting a pre-built workout ≠ coaching around intent) |

## 15. Recommendation (the shape, if/when it becomes YES)

When the foundation exists, the smallest true version is: **the athlete picks one focus from a
small curated set; Corner runs an authored session whose objective is that focus and hands the
focus to the coach as the session's intent; the coach's existing teach→reinforce memory is
pointed at it and it says *less*; the intent is never spoken.** No generation, no NLP, no
persistence, no scoring. Boring, authored, quiet, athlete-first.

**What would flip NOT YET → YES:**
1. A body of **authored, concept-tagged boxing content** (real rounds/cues that teach
   head-body, feints, exits… — human-authored, its own content discovery). *This is the gate.*
2. A **focus-aware coach** that uses the chosen concept to teach less and target more (a small,
   later coaching-runtime change — not now).
3. Evidence, via UAT, that a focused session actually *feels* like learning without the coach
   getting louder.

None of the three is built here; two of them are content and product discovery in their own
right.

## 16. Open questions

- How many curated focuses is *few enough* to stay boring and *many enough* to be useful?
- Can a session be assembled from *whole authored rounds* (safe boxing) without ever generating
  fragments? (Almost certainly the only acceptable path.)
- Does "the coach says less when it knows the focus" actually read as *more* coached, or as
  *neglected*? (A UAT question — the crux.)
- Is a *problem*/weakness input ever safe, given Corner must never claim to see the athlete?

## Verdict

**NOT YET.** The athlete owning *what they want to learn* is the truest north-star idea Corner
has surfaced, and its honest form — a picked focus, honoured by authored boxing, coached *more
quietly* — is real Corner. But it rests on a foundation that does not exist (concept-tagged
authored content), and every shortcut toward it (generation, natural language, curricula,
testing) is a Corner invariant broken. So: **affirm the principle, refuse the shortcuts, and wait
for the foundation** — the content and the focus-aware coach — before this becomes a small,
boring, beautiful YES.

*No code, no architecture. The deliverable is understanding.*
