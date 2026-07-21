<!-- Product & Experience Specification. Discovery, not implementation. No code. -->

# Spec — Developer Workout Stories

| | |
|---|---|
| **Status** | In Review |
| **Recommendation** | **YES** (scoped; single-session, dev-only, **in-memory / no persistence** — cross-session comparison + persistence are NOT YET) |
| **Author** | Discovery (Claude Code) |
| **Date** | 2026-07-21 |
| **PR** | spec-only |
| **Related** | [Flight Recorder](../observability/FLIGHT_RECORDER.md), [WHERE_IS_SPEECH_DYING](../media-runtime/WHERE_IS_SPEECH_DYING.md), [WAKE_LOCK_AND_IMMERSION](../media-runtime/WAKE_LOCK_AND_IMMERSION.md), [Your Session](./your-session.md) |

## The ask

> "Today I complete a workout and say **NO IDEA** what happened. Did wake lock hold? Did
> speech stall? Did Safari sleep? Were cues discarded? I want to look at the *Workout Story*
> and say *'Interesting — I know exactly what happened.'*"

## Problem — why now

Corner has excellent live observability — the DIAG overlay shows the Flight Recorder story
plus wake-lock, speech-boundary, and coach counters **while the workout runs**. But it lives
**only on the active workout page** (`WorkoutDiagnostics`, gated `NODE_ENV !== 'production'`).
The moment the workout completes and the athlete navigates to `/finish`, **all of it is
destroyed** — the Finish page has zero diagnostics. There is no way to review, after the
fact, what happened.

So a developer who notices something odd *after* a session — the screen slept, a line never
spoke, the coach felt off — has nothing to look at. The honest answer is **"NO IDEA."** Every
recent investigation (INV-001/002, WHERE_IS_SPEECH_DYING, WAKE_LOCK) was reconstructed from
screenshots and console logs *because the workout's own record didn't survive itself.*

**This is not Flight Recorder.** Flight Recorder is the live *narrative timeline* (what was
said, moment by moment). A **Developer Workout Story** is the post-workout **outcome digest** —
a verdict on the session's health — that **survives** completion. Related producers, different
artifact.

## Pre-implementation review (§0)

1. **What kind of problem?** Primarily a **developer-experience / observability** problem. Not
   a product problem (dev-only), not an investigation itself — it is the *tooling that makes
   investigations cheap*. The pieces exist; they just don't survive the workout.
2. **Should it exist?** Yes — the pain is real and recurring, and the data is already produced.
3. **Can something existing solve it?** The **data** is fully solved: Flight Recorder + the
   media/coach/speech diagnostics + `sessionId` + the Finish page all exist. What's missing is
   **capture-at-completion + survive-navigation + summarise into a verdict.** Nothing new needs
   to be *produced* — only *retained and digested*.
4. **Most boring architecture?** At the moment the workout finishes, take a **snapshot** of the
   diagnostics the overlay already reads (media + coach + speech) plus the Flight Recorder
   story, hand it to a **dev-only in-memory holder** (a module-level singleton, or a small root
   context), and render a **dev-only summary panel on the Finish page** that reads it. **No
   persistence** (see [Persistence review](#persistence-review--do-we-actually-need-it-v1-no)),
   no new runtime/manager/service/state-machine — a *projection of existing producers into an
   in-memory holder the Finish page reads across a single client navigation*.
5. **What would removing look like?** It removes a *practice*, not code: the screenshot-and-
   console investigation. It could also let the live overlay stay exactly as-is (the summary is
   its surviving snapshot), so nothing is duplicated.

## Recommendation — YES (scoped)

**YES** — build a **single-session, dev-only Developer Workout Story**: a snapshot of the
session's outcome, captured at completion, surviving to a dev-only panel on the Finish page,
rendered as a **digest/verdict** (not a dump), with the existing full story one tap/expand
away.

**NOT YET** — *cross-session comparison* ("was this different from yesterday's?"). That needs a
persisted dev history of stories; it's a natural follow-up once single-session survival exists.
Deferring it keeps this first step boring.

Why YES and not NOT YET for the core: the data already exists and is thrown away at the exact
moment it becomes useful; retaining and digesting it is small, dev-only, and directly kills the
"NO IDEA." This is a genuine gap, not building-because-requested.

## Philosophy review (§2)

**What becomes true:** *the next time Corner behaves differently, the first response is never
"NO IDEA" — it is "Interesting; let's look at the Workout Story."* Every session can account
for itself after the fact.

**Are we building Workout Stories / investigations / observability?** **Observability** — a
developer outcome digest. It is explicitly *not* the athlete's reflection (that's
[Your Session](./your-session.md), recommended NOT YET) and *not* a second copy of the Flight
Recorder timeline (that already exists, live). Correct problem: yes — make investigations cheap
by letting the workout remember its own health.

## Ownership review (§3)

| Concern | Owner | Change? |
|---|---|---|
| Workout memory (narrative) | Flight Recorder | unchanged |
| Observability (counters) | the media/coach/speech diagnostics | unchanged |
| Developer experience / this feature | a **dev-only view + snapshot store** over the above | **new view, no new owner** |
| Session identity | the Session Runtime (`sessionId`) | unchanged (reused as the key) |

**No new runtime / manager / service / abstraction.** A Developer Workout Story is a
*projection* of things that already own their data into a dev store the Finish page reads.
Boring over clever.

## Architectural review (§4)

- **Produces:** Flight Recorder (story) + the media/coach/speech diagnostics — *all exist*.
- **Consumes:** the **developer, after the workout** — the missing consumer (today they're
  consumed only live, then discarded).
- **Experiences:** **developers only** (dev-only; stripped from production).
- **Remembers:** a per-session snapshot held **in memory** for the single navigation to the
  Finish page. **No persistence** for V1 (see below). Cross-session memory = NOT YET.
- **Owns:** nobody new — it is a view. *Something already implemented (Flight Recorder + the
  diagnostics) naturally produces this; this work only retains + digests + surfaces it.*
- **Can existing things implement it?** Yes, entirely.
- **Can anything be removed?** The screenshot/console investigation practice.
- **Duplicated?** No — it snapshots existing state; it does not re-compute or re-own it.

## Persistence review — do we actually need it? (V1: no)

The draft said *"in-memory, or `localStorage` for survival."* Challenged: **V1 needs no
persistence of any kind.**

1. **Most boring possible implementation?** A **dev-only in-memory holder** — a module-level
   singleton (or a tiny root-layout context) with `set(story)` / `get()`. The active page
   writes the snapshot the instant the workout finishes; the Finish page reads it. That's it.
2. **Can it survive navigation WITHOUT persistence?** **Yes.** `/active → /finish` is a Next.js
   **client-side** navigation (`router.push`) — the JS runtime and module state stay alive, no
   reload. And the finish redirect fires **~2.6 s after** `phase === 'finished'`, so the
   recorder is still mounted to snapshot *before* it unmounts. An in-memory holder carries the
   snapshot across that single hop with no storage API.
3. **Are we accidentally solving tomorrow's problem?** **Yes — `localStorage`/repository
   persistence is cross-session-survival thinking**, which is *Workout History* territory
   ([Your Session](./your-session.md) / future). V1 only needs *this* session to survive *one*
   navigation. Persisting it now would be solving cross-session comparison before we've built
   single-session review.
4. **Absolute minimum for `Workout Complete → Developer Workout Story → DONE`?** Capture the
   snapshot at finish → put it in the in-memory holder → the Finish-page dev panel reads it.
   Nothing else. If a developer *hard-refreshes* `/finish`, the holder is empty and the panel
   shows nothing — **acceptable for V1** (you don't refresh the moment you finish; the live
   overlay covered the workout itself). That degradation is the price of staying offensively
   boring, and it's the right price.

**Conclusion:** V1 uses an **in-memory holder, no persistence.** Any storage (`localStorage`,
session repository) is explicitly deferred to a future cross-session / History spec.

## Would a developer naturally open this screen? (the make-or-break question)

**Yes — and that is why the Finish page is the right home.** After *every* workout, the
developer (like the athlete) lands on the Finish page automatically — it's already in the path,
and it doesn't auto-dismiss (it waits for the rating + Done). So the win-shape happens with
**zero extra intent:**

```
Workout complete → Finish page → (dev panel already there) → "Interesting…"
   → Speech ✓ · Wake lock held · Bell ✓ → DONE
```

The fail-shape — *"open console → open devtools → open diagnostics → NO"* — is avoided precisely
because the developer never has to *go* anywhere: the Story is waiting where they already are.
If this feature required opening anything, it would be the wrong home; it doesn't, so it's the
right one. **This PR succeeds or fails on that, and the Finish page passes.**

## Experience deliverables (§5) — what DONE feels like

```
TODAY                         TOMORROW
Workout complete              Workout complete
   ↓                             ↓
DONE                          Workout Story (dev):
   ↓                             Speech      ✓ 42/42 spoken · 0 dropped
What happened?                   Coach       ✓ 42 produced · 1 discarded (density)
   ↓                             Wake lock   ✓ held 18:03 · 0 releases
NO IDEA                          Visibility  ✓ 0 interruptions
                                 Bell        ✓ played (opening · rests · final)
                                 [ view full timeline ]  [ copy ]  [ .md / .json ]
                                 ↓
                              "Interesting — I know exactly what happened."
```

- **What developers should see:** a short **verdict per subsystem** — speech, coach, wake lock,
  visibility, bell — green/amber with the one number that matters, and the full Flight Recorder
  timeline one expand away.
- **What must NEVER be surfaced:** 200 logs, 30 pages of diagnostics, raw console output. A
  Developer Workout Story is a **digest**, not a dump. If it needs scrolling to understand
  whether the session was healthy, it has failed.

## Surfacing deliverables (§6)

1. **Where:** a **dev-only panel on the Finish page** (the natural post-workout home), plus the
   live overlay unchanged during the workout.
2. **Survive navigation?** **Yes — that is the whole point** (the current gap) — via the
   in-memory holder, **no persistence** (see the Persistence review).
3. **Exportable?** Yes — reuse the existing markdown/JSON export.
4. **Replace most screenshot investigations?** Yes — that is the success test.
5. **Stay DEV ONLY?** **Yes, intentionally.** This is not an athlete surface; the athlete's
   reflection is a separate, deferred concern ([Your Session](./your-session.md)).

## Wiring / orphan audit (§7)

**The orphan:** the Flight Recorder story **and** the live diagnostics are produced and consumed
**live** (the DIAG overlay) but **discarded at `WORKOUT_COMPLETED`** — there is no post-workout
consumer. Developer Workout Stories adopt exactly that consumer. No *new* producer is needed.

Other checks: `sessionId`, duration, rounds, rating/notes are all consumed (Finish + History) —
not orphaned. The story's md/json exports are consumed on demand. No additional orphans found;
the single one is "the session's health record, after the session."

## Intentional omissions (§8)

- **Athlete-facing reflection / "Your Session"** — separate spec, NOT YET.
- **Workout History (product), session memories, sharing, analytics, achievements** — product
  concerns; belong to a future Workout History, not here.
- **Cross-session comparison ("vs yesterday")** — NOT YET; a follow-up once single-session
  survival exists.
- **Any persistence** (`localStorage`, the session repository, a dev history) — deliberately
  none for V1; it's cross-session/History thinking (see the Persistence review). Deferred.
- **Any production surface** — deliberately none; this is dev-only.

## Questions to answer (§9)

1. **What becomes possible?** Reviewing a session's health *after* it ends; catching the
   intermittent (one wake-lock release, one dropped line) without staring at a live overlay for
   30 minutes.
2. **What future investigations open?** Wake-lock, speech, personality, and Safari
   investigations become *"open the Workout Story"* instead of *"reproduce with the console
   open."* A future **Workout History** could persist these digests.
3. **What follows?** Cross-session comparison; a persisted dev history; possibly feeding the
   digest into bug reports.
4. **What should NEVER happen?** No `WorkoutStoryRuntime`. No duplicated session state. No
   console-driven UAT. No leaking dev diagnostics into production.

## Success criteria (§10)

- **Fails if:** after a workout, the developer still says **"NO IDEA"** — i.e. the digest
  doesn't survive to where they look, or is a dump they won't read.
- **Succeeds if:** the next odd behaviour prompts **"Interesting — let's look at the Workout
  Story,"** and the answer is right there on the Finish page.

**How would we know it FAILED despite all tests passing?** If it's a wall of counters nobody
reads; if it duplicates session state or adds a runtime; if it survives but on a screen the
developer never opens; or if it silently ships to production. Green tests prove the snapshot is
captured — they can't prove it's *legible* or *lives where the eyes go*.

## Final product review (§11)

1. **Should it exist?** Yes (scoped). 2. **Consumes?** developers, post-workout. 3.
**Experiences?** developers only. 4. **Lives?** a dev-only Finish-page panel (+ export). 5.
**Not done?** athlete reflection, History, cross-session comparison, **any persistence**, any
production surface. 6. **Follows?** cross-session comparison; a persisted dev history. 7.
**Removable?** the screenshot/console practice. 8. **Would a developer smile tomorrow?** Yes —
never saying "NO IDEA" again is exactly the smile.

---

**Recommendation restated: YES** — a single-session, dev-only Developer Workout Story that
survives to the Finish page as a health digest (Flight Recorder timeline one tap away), built
as a boring projection of existing producers into an **in-memory holder — no persistence.**
**Cross-session comparison and any persistence are NOT YET.** The goal is not to surface Flight
Recorder — it is to ensure Corner's next surprise is met with *"Interesting; let's look at the
Workout Story,"* never *"NO IDEA."*
