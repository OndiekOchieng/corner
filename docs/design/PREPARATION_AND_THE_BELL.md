# PR-030 Review (Part II) — Preparation & the Boxing Bell

**Investigation only. No implementation. No architecture redesign.** A continuation of
[PRESENCE_AND_TRANSITIONS.md](./PRESENCE_AND_TRANSITIONS.md) and
[BELL_PHILOSOPHY.md](./BELL_PHILOSOPHY.md).

PR-030 removed the countdown and let the bell open the round. Athletes then found the
real gap — not the missing words, but the missing *room*:

> "There is no bell at the beginning. The bell doesn't sound like boxing. There is no
> room to prepare myself before boxing begins."

The reframe that matters: the athlete is not **waiting**. The athlete is **preparing**.

---

## The two findings, in the code

**1. Boxing starts the instant START is pressed.** `useCoachedWorkout` calls
`runtime.controller.start()` synchronously in the build effect (line ~192) — the engine
clock and round one begin immediately. And no bell rings at the opening: `MediaRuntime.onEvent`
rings only `ROUND_STARTED` / `REST_STARTED` / `WORKOUT_COMPLETED`; there is **nothing at
`WORKOUT_STARTED`**. After PR-030 suppressed the round-one intro, the first round-start
bell fires buried against the opening speech, with zero room before it. Tap → box. No
arrival.

**2. The bell is literally a beep.** `AudioManager.emitTone` plays *one* `sine` oscillator
per tone with a short exponential decay:

```ts
osc.type = 'sine';
gain.setValueAtTime(volume, start);
gain.exponentialRampToValueAtTime(0.0001, end);   // ~0.2s
```

A single sine with a fast decay is a "boop." A struck boxing bell is metal: a fast strike,
several **inharmonic** partials, and a **long ring-out**. The complaint is correct and
fully explained by the synthesis.

**Grounding note:** the Engine *already* has a `warmup` phase (`Phase = 'idle' | 'warmup'
| 'round' | 'rest' | 'finished'`) and builds a timed segment when `warmupMs > 0`. So a
pre-round segment already exists — but "warmup" means *light boxing with coaching*, not
*silent arrival*. Preparation is a different thing wearing a similar shape.

---

## Q1 — Who owns Preparation?

> The Engine owns time. The Bell owns transitions. The Coach owns behaviour. Silence owns
> presence. The Athlete owns the experience.

**Recommendation: Preparation is a *Presence* concern, owned at the session start-sequence
edge — the doorway *before* the Engine's clock starts. It is closed by the Bell, filled by
Silence, and the Coach may offer at most one arrival line. It is NOT an Engine phase and
NOT a new runtime.**

The cleanest model: **the Engine's `t=0` is the opening bell — the moment boxing actually
begins.** Preparation is the room *before* `t=0`. That keeps three things honest:

- **The Engine stays pure** — it still models only timed boxing (round/rest). No new phase,
  no `PreparationRuntime™`.
- **History stays honest** — recorded duration is *boxing*, not staring-at-a-screen time.
- **The seam already exists** — Preparation lives exactly where `controller.start()` is
  called today (the app/host start sequence in `useCoachedWorkout`). Preparation = *don't
  start the clock the instant START is pressed*.

So: **Presence owns it; the Bell ends it; the Engine begins after it.** "Session Runtime"
(persistence/History) is the wrong home; the Coach is the wrong owner (arrival is not
behaviour). Preparation is the athlete's, not the software's.

---

## Q2 — What happens immediately after START?

```
TODAY                     RECOMMENDED (Presence-owned, engine unchanged)
─────────                 ─────────────────────────────────────────────
START                     START
  ↓                         ↓
boxing (t=0 instantly)    PREPARATION   ← room; clock NOT started
                            ↓
                          (silence, or ONE grounding line: "Good evening.")
                            ↓
                          athlete becomes present  (ready-gated or short lead-in)
                            ↓
                          DINGGG  ← the opening BELL (a real one) = engine t=0
                            ↓
                          BOX
```

Among the PR's alternatives, the strongest is **START → Preparation → (silence, or one
line) → Bell → BOX**. The bell — not a word — is the threshold. A single optional line
("Good evening.") is acceptable; a *stance* prompt ("Take your stance.") is acceptable and
on-theme. Anything more (combinations, coaching, urgency) belongs after the bell.

---

## Q3 — The Boxing Bell

The question is not "what sounds good" but "what sounds like boxing." A real ring/gym bell
is a **struck idiophone**: near-instant attack, a bright metallic "clang" from several
**inharmonic** partials, and a **long exponential ring-out** (1–3 s). The current beep has
none of these.

**Recommendation — improve the *timbre* of the one universal bell; add no systems.** This
is a change to `AudioManager.emitTone` only. Sketch (not implemented here):

- **Additive inharmonic partials** per strike — a fundamental plus overtones at non-integer
  ratios (the classic struck-bell ratios ≈ 1, 2.76, 5.40, 8.93 …), each its own decaying
  oscillator. That "clang" is what a sine can never make.
- **Fast attack, long decay** — a few-ms attack then an exponential ring-out ~1–2.5 s (vs
  today's 0.2 s), so it *rings* instead of *beeps*.
- **The round bell stays a double strike** ("ding-ding"); rest a single, softer strike;
  the finish a final, fuller ring. Same events, same one bell — richer voice.
- **Still universal.** No bell personalities, no coach-pack bells, no second system. The
  bell is the room, not the trainer.

| Bell design | Immersion | Cost | Verdict |
|---|---|---|---|
| Today: single sine + 0.2 s decay | low ("a beep") | — | replace timbre |
| Additive inharmonic partials + long ring-out | high | one function, `emitTone` | **recommended** |
| Sampled `.wav` boxing-bell assets | highest fidelity | asset pipeline, licensing, load/unlock | acceptable later; heavier |
| Per-product / per-pack bells | — | forks the archetype | **reject** |

Synthesis is preferred over sampled assets for the first pass: no files to load/unlock, no
licensing, deterministic, and it stays inside the existing Web-Audio path.

---

## Q4 / Q8 — Does one bell (and Preparation) survive across products?

| Product | Rounds? | Bell | Preparation |
|---|---|---|---|
| Heavy bag | yes | yes | yes |
| Pads | yes | yes | probably yes |
| Sparring | yes | yes | probably yes |
| Competition camp | yes | yes | yes |
| Skipping | intervals | interval/start-stop | maybe |
| Roadwork | continuous | little/none | **no** |
| Mobility | continuous | none | **no** |
| Rehabilitation | continuous | none | **no** |

Both the Bell and Preparation **survive exactly where round-structured boxing survives**,
and fall away in continuous work — independent of product. That is the same result the bell
gave us, and it validates the same principle: **the Bell owns transitions, and Preparation
owns arrival-into-rounds — neither is owned by a product.** A product that has a "step up
and begin" moment gets both; one that just flows gets neither. Their natural disappearance
is a feature, not a gap.

---

## Q5 — Preparation duration

**Recommendation: optional, short, workout-dependent — and ideally athlete-gated, not a
fixed clock.** "Give the athlete room to arrive" is best served by letting the athlete end
Preparation (an "I'm ready" tap / first interaction), with a modest default lead-in as the
fallback.

- **Optional** — off entirely for products/workouts that don't want it (see the table).
- **Short by default** — ~10 s, not 30. Thirty seconds is *waiting*; the goal is *arrival*.
  Five can feel abrupt; ~10 is a breath and a stance.
- **Athlete-gated where possible** — the truest realisation of "the workout begins when the
  athlete is ready, not when they press START" is a "ready" gesture that rings the opening
  bell. A fixed timer is the graceful fallback.
- **Not mandatory, never long.** Preparation that feels like a loading screen has failed.

---

## Q6 — What should Preparation teach?

**Arrival, readiness, presence — nothing else.** No combinations, no coaching, no urgency.
At most one grounding line ("Good evening." / "Take your stance.") then silence. The
success test is the athlete thinking *"I am ready to box,"* never *"the software is
waiting."* If Preparation ever teaches, it has become a lecture with a countdown — exactly
what PR-028 and PR-030 removed.

---

## Q7 — Architecture (what NOT to build)

Reject, per the constraints and PR-030's "ship by removing" ethos:

- **No new Engine phase** — the Engine already models timed boxing; Preparation isn't
  boxing time. Adding a `preparation` phase redesigns the Engine for a doorway.
- **No `PreparationRuntime™`** — it owns no judgement (no silence gates, no memory, no
  ordering). A runtime would be ceremony around "wait for the bell."
- **No Media/Coach redesign** — the bell change is one function; the arrival line is one
  optional coach line.
- **Reuse, don't add.** The start-sequence seam (`controller.start()` in
  `useCoachedWorkout`) is where Preparation naturally lives — as *not starting yet*, closed
  by the existing round-start bell (with a better timbre).

Alternatives, ranked:

| # | Design | Engine change? | Verdict |
|---|---|---|---|
| A | Preparation at the start-sequence edge; clock starts at the opening bell | none | **recommended** |
| B | Reuse the existing `warmup` segment as a *silent* prep lead-in | none (authoring) | acceptable; but overloads "warmup" and inflates recorded duration |
| C | Add a first-class `preparation` Engine phase | yes | reject — redesigns a working Engine for a doorway |
| D | Do nothing | none | reject — the arrival gap is real athlete feedback |

---

## Lifecycle — does Preparation belong in the model?

```
EXPERIENCE (what the athlete lives)        ENGINE (what is timed & recorded)
──────────────────────────────────        ─────────────────────────────────
START pressed                              (idle)
   ↓
PREPARATION  ← Presence owns this          (still idle — clock not started)
   ↓  silence / one arrival line
   ↓  athlete becomes present
DINGGG (opening bell)  ───────────────▶    t=0  ROUND 1 begins   ← Engine starts HERE
   ↓
ROUND → REST → ROUND → … → COMPLETE        round / rest / … / finished  (unchanged)
```

Preparation is **first-class in the *experience*, not in the *Engine*.** It belongs to the
workout the athlete lives, but sits *before* the workout the Engine times. That is the
whole design: name it, give it room, close it with a bell — and change nothing that works.

---

## The four answers

**1. Is Preparation a first-class phase of the workout?**
Yes — of the *experience*, owned by **Presence at the start-sequence edge**, not a
first-class *Engine* phase. The Engine's clock begins at the opening bell; Preparation is
the room before it. First-class enough to be named and given room; small enough to need no
new runtime or engine phase.

**2. Does a proper boxing bell materially improve immersion?**
Yes. The current bell is a decaying sine — a beep. A struck-bell timbre (inharmonic
partials + long ring-out), done inside the existing single universal bell via one change to
`emitTone`, is the highest immersion-per-line-of-code change available. High confidence.

**3. What gives the athlete the greatest room to arrive before boxing begins?**
Silence plus a real opening bell, with the **clock not starting until the bell** — ideally
athlete-gated ("ready" → bell), with a short (~10 s) lead-in as fallback. The room is made
by *not starting instantly* and *not filling the gap with words*.

**4. Does this help the athlete forget they are training with software?**
Yes. Software begins the instant a button is pressed; a gym lets you wrap your hands, take
your stance, and waits for the bell. Preparation + a real bell turns "tap → beep → boxing"
into "arrive → the bell → box." It removes abruptness (the app-ness) and restores the
ritual of a real session.

---

*Recommendation summary (for a future, small implementation PR — not this one):
(a) hold `controller.start()` behind a brief, optional, ideally athlete-gated Preparation
window at the `useCoachedWorkout` edge — silence, at most one arrival line, closed by the
opening bell; (b) enrich `AudioManager.emitTone` into a struck-bell timbre — one universal
bell, no new systems. Both inherit PR-030's ethos: improve immersion by adding almost
nothing, and by refusing to start the workout until the athlete is ready to box.*
