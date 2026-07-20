<!-- Product & Experience Specification. Discovery, not implementation. No code. -->

# Spec — Your Session (surfacing the workout's story to the athlete)

| | |
|---|---|
| **Status** | Deferred |
| **Recommendation** | **NOT YET** (with a small **YES** carve-out — see §1) |
| **Author** | Discovery (Claude Code) |
| **Date** | 2026-07-20 |
| **PR** | spec-only |
| **Related** | [Flight Recorder](../observability/FLIGHT_RECORDER.md) (PR-032/034), [Coach Continuity (INV-001)](../coaching-runtime/COACH_CONTINUITY.md), [Session Runtime](../session-runtime/) |

## The ask

> "The workout should leave behind an honest, beautiful story of itself — surface *Your
> Session* to the athlete." (implied by the Flight Recorder + Finish-page surface work)

## Problem — why now

Corner **already remembers every workout** — the Flight Recorder builds an honest,
temporally-correct story of each session. But that memory is currently consumed **only by
developers** (the dev-only DIAG overlay, gated behind `NODE_ENV !== 'production'`) and then
**discarded**. The athlete never experiences their own session. *"Corner remembers the
workout"* is true for the engineer and false for the person who boxed.

The Finish page compounds it: its closing words are a **generic, hard-coded** *"That was
honest work. Well done."* — not the voice of the coach the athlete just trained with, and not
shaped by what actually happened. The last thing the athlete hears from Corner is
out-of-character.

## Recommendation — NOT YET (with a small YES)

**The feature as imagined — surfacing the workout's *story* to the athlete — is NOT YET.**
Discovery is a success precisely here: this is an *important decision* worth slowing down.

Why not now:

1. **Wrong form.** The Flight Recorder's story is a developer **timeline/transcript**
   ("Coach: Move.", "Countdown: 5", "Cue scheduled: …"). The athlete does not want a
   play-by-play of their own session — they want **reflection**. That reflection form does
   not exist yet and needs design, not a quick render of the dev view.
2. **It doesn't survive the moment.** The story lives in the active workout's runtime and is
   destroyed on navigation to `/finish` (a separate route reached via query params). Surfacing
   it needs the story — or a compact reflection — to **persist** (a Session Runtime extension)
   or be handed across. That is a real architectural step deserving its own spec.
3. **No lasting home.** A single Finish-screen glance forgets itself. The natural home for
   *Your Session* over time is a **Workout History** product — which does not exist yet.
4. **Philosophy risk.** *Put the phone down; forget the phone exists.* A screen that quantifies
   the athlete ("you did X at 0:10") is the opposite of Corner. Getting reflection right —
   honest, in-character, un-gamified — matters more than shipping it fast.

**What *is* worth doing now (a small YES, its own tiny spec):** make the Finish page's closing
line **coach-voiced and session-shaped** — replace the generic *"That was honest work"* with
the athlete's coach in its own register, derived from the coach pack + rounds/duration (both
already available). Old School: *"Three rounds. Honest work. Good."* · Fight Night: *"Three
rounds — you left it in there. Respect."* No persistence, no new runtime, no story required —
it extends the coach's character to the last screen. This is a *replacement*, not an addition.

**What would flip NOT YET → YES for the full feature:** (a) a decision to **persist a compact,
athlete-voiced reflection** alongside the session (reusing the existing session repository);
(b) a **reflection design** — coach-voiced, a few genuine beats, never a transcript, never
inflated; (c) a **Workout History** surface to give it a home.

## Pre-implementation review (§0)

1. **What problem?** The athlete's own session is remembered by the product but never
   experienced by them; the coach's voice stops one screen too early.
2. **Who owns it?** **Reflection** — a new *experience*, owned at the session's close (the
   Finish surface), voiced by the **Coach**, fed by **Memory** (the Flight Recorder), and
   ultimately belonging to the **Athlete** (it is their session).
3. **What kind of problem?** A **product + experience** problem with a small **wiring** tail
   (an orphaned producer). It is *not* an architectural problem — no new runtime is needed.
4. **Should it exist?** The *reflection* should; the *transcript* should not. A coach reflects
   after a session; a dashboard does not belong in Corner.
5. **What would removing look like?** The immediate win *removes* generic copy. The full
   feature must resist *adding* a data screen — reflect, don't report.
6. **Can something existing solve it?** Yes, partially — the coach's finish register + the
   session stats already exist (the small YES). The rich story exists too, but is not yet
   reachable at finish time (the NOT YET).
7. **Most boring architecture?** The Finish page (which already exists) reads what it already
   has (coach pack + rounds + duration) and renders a coach-voiced close. The richer version:
   the session repository (which already persists sessions) stores one short reflection string;
   the Finish page and a future History read it. **No new runtime, manager, service, or
   abstraction** in either case.

## Philosophy review (§2)

**What should become true:** *Corner remembers **your** session — and reflects it back to
you, in your coach's voice, honestly.* The memory stops being the developer's alone.

**Philosophy protected:** *"The workout should leave behind an honest, beautiful story of
itself"* (Flight Recorder) — extended from the engineer to the athlete. And **trust**: the
reflection must be *honest* (never inflated praise, never claim to have *seen* the athlete —
only what the session's structure and the coach's words actually were). Reflection is
coaching's natural bookend; a data readout is not.

## Ownership review (§3)

| Concern | Owner | Change? |
|---|---|---|
| Time | Engine | unchanged |
| Behaviour | Coach | unchanged |
| Transitions | Bell | unchanged |
| Presence | Silence | unchanged |
| Memory | Flight Recorder (parasitic) | unchanged |
| **Reflection** | the Finish/close **experience** (voiced by Coach, fed by Memory) | **new experience, not a new owner** |
| This feature | the Athlete's session-close surface | — |

**Ownership does not move or duplicate.** No new runtime / manager / service / abstraction is
introduced by either the YES or the eventual full feature. Reflection is a *view* over things
that already own their data — the boring choice over a clever one.

## Architectural review (§4)

- **Produces:** the Flight Recorder (story) — *exists*. The coach's finish register — *exists*.
- **Consumes:** the Finish page — the **missing consumer** for the athlete.
- **Experiences:** the Athlete.
- **Remembers:** the Flight Recorder (in-memory today; **not persisted** — the gap).
- **Owns:** the session-close experience.
- **Can it use only existing things?** The small YES: yes, entirely. The full feature: needs
  one boring persistence step (reuse the session repository), no new architecture.
- **Can anything be removed?** Yes — the generic hard-coded Finish copy.
- **Anything duplicated?** No.

## Wiring / orphan audit (§9) — the headline

**One orphan found.** The Flight Recorder **story** is *produced* every workout but *consumed*
only by developers (dev overlay) and then *discarded* — no athlete experience, no persistence,
no successor. Everything else Corner produces at finish **is** consumed: duration, rounds, and
the rating/notes flow into the Finish page and History (`rateSession`). The coach's spoken
close is consumed (heard) but ephemeral.

So the audit's verdict: the narrative memory is the single thing produced-without-an-athlete-
consumer. This spec's job is to give it one **when the reflection form and its home exist** —
and, until then, to *intentionally* leave it dev-only (it is not orphaned by accident; it is
deliberately dev-scoped, recorded here, with a named successor: *Your Session* / Workout
History).

## Deferred deliverables (§5–§8) — filled on YES, sketched here

- **Experience (§7) — what DONE feels like:** the athlete finishes, catches their breath, and
  the screen quietly reflects *their* session in *their* coach's voice — *"Three rounds. The
  jab got sharp. You dug deep. Respect."* — and they **smile**, they don't study. Never a
  timeline, never a metric they didn't feel.
- **Surfacing (§8):** **Finish page** (production) for the immediate close; **Workout History**
  (future) for the lasting reflection. **Never** the active workout screen (mid-flow reflection
  is anti-immersion). Developers keep the verbose timeline (unchanged).
- **Consumption (§6):** *Athletes* — see their session reflected honestly. *Developers* —
  unchanged (dev story stays). *Future products* — Workout History lists reflections over time.
- **Implementation/testing/docs:** deferred until YES; the boring shape is a `reflection()`
  view over the recorder (athlete-voiced, curated) + one persisted string + a Finish/History
  reader + tests + a doc update.

## Intentional omissions (§10)

- **Persistent, story-driven *Your Session* + Workout History** — NOT YET; needs persistence,
  a reflection design, and a History home (future specs).
- **Any athlete-facing timeline/transcript** — deliberately **NO**, now or later. Reflection,
  not report.
- **Mid-workout surfacing** — NO (anti-immersion).
- **Trends, streaks, scores, sharing, achievements** — NO (see §13).

## Questions to answer (§11)

1. **What became possible?** A clear, honest decision — and a small shippable win (coach-voiced
   finish) if we want it.
2. **What became impossible?** Accidentally building an athlete dashboard by rendering the dev
   timeline. Discovery caught it.
3. **What remains unanswered?** The reflection *form* (how many beats, how curated), and where
   the reflection is persisted.
4. **What future investigations open?** How to persist a compact reflection without bloating
   the session repository; how a reflection reads across many sessions without becoming a chart.
5. **What naturally follows?** A *coach-voiced Finish close* spec (small, now), then a *Workout
   History + reflection persistence* spec (later).

## Success criteria (§12)

- **Athlete:** feels *seen and remembered*, in their coach's voice — **without feeling
  quantified.** Would smile if it shipped tomorrow.
- **Developer:** unaffected — the verbose story stays exactly where it is.
- **Coach:** stays in character to the very last screen.
- **Corner:** the workout's memory is no longer orphaned from the person who made it.

**How would we know it FAILED despite all tests passing?** If it reads as a *data dashboard*,
if it *inflates* praise (breaking trust), if it *claims to have seen* the athlete, or if it
pulls attention back to the phone. Green tests can't catch any of those — only the experience
can.

## The next work (§13)

1. **Naturally becomes possible:** a coach-voiced finish (now); persistent Workout History with
   honest reflections (later); "your last session" continuity into the next warm-up.
2. **Naturally follows:** the reflection-persistence + History specs.
3. **Should NEVER happen:** streaks, scores, leaderboards, badges, shame, or any mechanic that
   makes the athlete train *for the app* instead of *for the boxing*. Corner reflects; it never
   gamifies.

## Final product review (§14)

1. **Produces?** Flight Recorder (exists). 2. **Consumes?** Finish page (the missing consumer).
3. **Experiences?** the Athlete. 4. **Remembers?** Flight Recorder (in-memory; persistence is
the gap). 5. **Owns?** the session-close experience — no new owner. 6. **Natural home?** Finish
page now, Workout History later. 7. **Deliberately not done?** the transcript, persistence,
History, and any gamification. 8. **Naturally follows?** coach-voiced finish → History +
reflection. 9. **Can anything be removed?** yes — the generic Finish copy. 10. **Would an
athlete smile tomorrow?** At a coach-voiced close — yes. At a data screen — no; so we won't
build that.

---

**Recommendation restated: NOT YET** for *Your Session* (the athlete-facing workout story) —
it needs a reflection form, persistence, and a History home first. **A small YES** is
available now: make the Finish page's close coach-voiced. Both are successful discovery
outcomes. *Corner should never implement work simply because it was requested* — and here,
the honest answer is: reflect, don't report; and not yet.
