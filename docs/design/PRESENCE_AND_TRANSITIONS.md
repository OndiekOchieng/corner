# PR-030 — Presence & Transitions

> Put the phone down. Forget the phone exists.
> We'll give you room to wear your gloves, hear the bell, become present, and box.

This PR is **not** about adding bells. It makes Corner feel less like software and more
like stepping into a gym. It follows the investigation in
[BELL_PHILOSOPHY.md](./BELL_PHILOSOPHY.md) and implements only its highest-confidence,
smallest recommendations — **two coach-side changes, zero new abstractions, no engine or
runtime redesign.**

## The four teachers

```
   Time   → teaches rhythm       (the Engine)
   Bell   → teaches transitions  (Media, driven by engine transitions)
   Coach  → teaches behaviour    (Coach Runtime)
   Silence→ teaches presence     (the space we stopped filling)
```

Corner had been letting the Coach do three of these jobs at once — greeting, numbering
the round, *and* counting the clock. This PR gives two of them back to the Bell and to
Silence.

---

## What shipped

Both changes live in one file — `CoachDirector.ts` (the engine-event → intent mapper).
Nothing else moved. The Engine stays exactly as intelligent as before; the Bell, Media,
Event, Coach, and Session runtimes are untouched.

### 1. The coach stopped counting (Part Three)

`COUNTDOWN_SECOND` no longer produces a spoken line. The coach used to say
*"Ten seconds. … Five. Four. Three. Two. One."* — a machine reading a clock aloud. It is
gone.

- **Timing is unchanged.** The Engine still emits `COUNTDOWN_STARTED` / `COUNTDOWN_SECOND`
  markers, and the coach still uses them to avoid *starting* a line the boundary would cut
  (PR-021 preemption). The countdown renderer, priority, and interrupt machinery are all
  retained as capability — only the *trigger* was removed. Removing spoken countdowns did
  **not** remove timing.
- **What fills the last ten seconds now?** Silence — then the **bell**. `ROUND_COMPLETED →
  REST_STARTED` rings the rest bell; the final round rings the finish bell. The transition
  is *marked*, not *narrated*.
- **Behaviour survives.** On the **final** round, `COUNTDOWN_STARTED` still fires one short
  behavioural push ("Dig!", "Empty it — now!") — that is *behaviour* ("leave nothing"),
  not counting. Authored 30s / 1-min time-anchors ("Thirty seconds. Sharpen up.") remain
  available for workouts that want them — also behavioural, used sparingly.

### 2. The Bell announces Round One — the coach doesn't (Parts One & Four)

`ROUND_STARTED` for `roundNumber === 1` no longer emits a `round_intro`. The opening is now:

```
   "Alright. Orthodox Power. Let's work."      ← one greeting
                    ↓  (room)
                 DINGGG                          ← the bell opens round one
                    ↓
                  box                            ← authored cues, coaching
```

instead of *intro → "Round 1. …" → box*. The bell owns transitions, so the coach numbering
the first round was the software saying out loud what the bell already says. **Later rounds
keep a brief intro** ("Round 2. Cross — let me see those hands." / "Round 3 … leave
nothing.") — a single bell can't convey *which* round or *the last* round, and that
orientation is genuine coaching, not ceremony.

**Verified transcript (default coach, real 3-round workout):**

```
  1. Alright. Orthodox Power. Let's work.        ← greet once
  2. Warm up. Get loose, get sharp.
  3. Jab                                          ← round 1: BELL opened it, coach did not number it
  4. Good. Own the range.
  5. Good round. Breathe. Next: Cross.
  6. Round 2. Cross — let me see those hands.     ← later rounds still oriented
  7. Cross
  8. Nice work. Recover. Hook — we press.
  9. He can’t hit what isn’t there. Move and fire.
 10. Round 3. This is where fights are won. Hook — leave nothing.
 11. Hook
 12. That's a fighter's session. 3 rounds, you dug deep. Respect.
```

No "Round 1". No "Ten seconds… five… four". The bells (not shown — they belong to the
Media Runtime) mark every boundary.

---

## Ownership (confirmed, unchanged)

```
        Engine  (owns TIME → emits neutral transition events)
                     │
        ┌────────────┴────────────┐        peer EventBus subscribers
        ▼                         ▼
   Coach Runtime            Media Runtime
    (BEHAVIOUR)               (the BELL)
        │                         │
   speaks only when         rings only when
   silence would coach       silence would mark
   less effectively          the transition less effectively
        └────────────┬────────────┘
                     ▼
                  Silence  (owns PRESENCE — the space neither fills)
                     ▼
                  Athlete
```

- **Bell owns transitions** — round begin/end, rest, return, final bell. It already did;
  this PR stopped the coach from competing with it (round-one number, countdown numbers).
- **Coach owns behaviour** — everything the athlete should *do*. Unchanged.
- **Silence owns presence** — newly respected: the last ten seconds of a round, and the
  beat before the first bell, are now the athlete's, not the app's.

---

## Sequence — a round boundary, before vs after

```
BEFORE                                   AFTER (PR-030)
─────────────────────────────           ─────────────────────────────
… coaching …                            … coaching …
"Ten seconds."   ← coach counts          (silence)      ← the athlete's space
"Five."                                  (silence)
"Four."                                  (silence)
"Three."                                 (silence)
"Two."                                   (silence)
"One."                                   (silence)
[round ends]                             [round ends]
DING (rest bell)                         DING (rest bell)   ← the bell alone marks it
"Round 2. …"                             "Round 2. …"
```

The machine-voice reading a countdown is replaced by the room's bell. Fewer words, more
gym.

---

## Alternatives considered & rejected

| Option | Why not |
|---|---|
| Keep spoken countdowns | the single most software-like moment in the app; a gym never counts you in aloud |
| Remove the Engine's countdown markers too | would blind the coach's preemption (PR-021) — "remove counting, not timing" |
| Suppress *all* round intros (even 2+) | a bell can't say *which* round or *the last* — loses real orientation/behaviour |
| Add a distinct "final round" bell | speculative; the coach already frames the last round behaviourally — no new sound needed |
| Improve bell *timbre* to a struck-metal boxing bell | genuinely desirable, but can't be auditioned here; deferred to an audio-QA'd follow-up, not shipped blind (Part Two: all four transitions already ring) |
| A `TransitionRuntime` / bell personalities | violates "no new runtimes / the bell is universal"; a transition needs no judgement to own |

---

## Part Two — do proper bells already exist for the four transitions?

Yes. `MediaRuntime.onEvent` already rings: `ROUND_STARTED → round-start` (also the
return-to-work after rest), `REST_STARTED → rest-start` (the round-*end* moment),
`WORKOUT_COMPLETED → finish`. All four transitions the PR lists are covered by **one
universal bell** — the room, not the trainer. No new bells, no personalities. (A latent
unused `'warning'` tone exists for a future, optional 10-second clacker; left unwired.)

## Part Six — does the Bell survive only where rounds survive?

| Product | Rounds? | Bell |
|---|---|---|
| Heavy bag, Pads, Sparring, Competition camp, Shadow | yes | full bell |
| Skipping | intervals | bell on intervals, or start/stop |
| Roadwork, Mobility, Rehab | continuous | little/none |

The Bell survives exactly where round-structured time survives — independent of product or
coach. That confirms it: **the Bell owns transitions, not products.** The same neutral
engine transitions drive it everywhere rounds exist and simply stop occurring where they
don't. One universal bell scales the whole future catalogue with no re-authoring.

---

## The one question

> **Does this help the athlete forget they are training with software?**

**Yes.** We removed the two moments where the app was most obviously *an app*: a voice
counting "ten… five… four" and a voice announcing "Round One" over the bell that already
announced it. In their place: the bell, and silence. The athlete now gets room to wear
their gloves, hear the bell, trust their coach, and box.

Success here is not more speech, more bells, or more features — it is **less software.**
Two conditions removed; nothing added. Smaller, and more immersive.

---

*Implementation: `CoachDirector.ts` (two guarded returns) + a clarifying note in
`SpeechPlanner.ts`. Tests updated to assert the new philosophy (no counting; the bell owns
round one) across `runtime`, `temporal`, `media/runtime`, and `liveWiring`. 301 tests
pass, tsc clean. The countdown/round-intro machinery is retained — the change is a change
of when we speak, not of what we can.*
