# PR-030 — The Bell: philosophy & architecture investigation

**Investigation only. No implementation. Smaller designs preferred.**

> We are not trying to play sounds. We are trying to create an exceptional boxing
> training experience.

This document investigates where the Bell belongs. It ends by answering only four
questions: *What is the Bell? What does it own? Where does it belong? How does it make
the athlete forget they are training with software?*

---

## 0. What the code actually does today (ground truth)

Before recommending anything, the current wiring — because it already answers more of
the question than the prompt's `Engine → Media → playBell()` sketch suggests.

- **The Engine emits neutral transition events** on a bus: `ROUND_STARTED`,
  `ROUND_COMPLETED`, `REST_STARTED`, `REST_COMPLETED`, `COUNTDOWN_STARTED`,
  `COUNTDOWN_SECOND`, `WORKOUT_COMPLETED`, … (`engine/Events.ts`).
- **The Coach Runtime and the Media Runtime are *peer subscribers*** on that same bus
  (`runtime` EventBus). The coach runs first (speech enqueued), the media plugin second
  (`priority = 40`). Neither is downstream of the other.
- **The bell lives in the Media subscriber** (`MediaRuntime.onEvent`):
  `ROUND_STARTED → bell('round-start')`, `REST_STARTED → bell('rest-start')`,
  `WORKOUT_COMPLETED → bell('finish')`. Bells are 3 synthesised Web-Audio tones
  (`AudioManager.BELLS`).
- **The countdown is *spoken by the coach*, not belled.** `COUNTDOWN_SECOND` →
  `CoachDirector` → `'countdown'` intent → "Ten… Five…". The bell never counts.
- **A fourth bell, `'warning'`, is defined but never fired** — a latent 30s/10s warning
  tone with no trigger.

**So the real shape is already this:**

```
                 Engine  (owns time → emits transition events)
                    │
             ┌──────┴───────┐          both are EventBus subscribers,
             ▼              ▼           siblings, not a chain
      Coach Runtime    Media Runtime
        (behaviour)      (mechanism)
             │              │
          Speech          Bell
             └──────┬───────┘
                    ▼
                 Athlete
```

The prompt's proposed `Transition → {Bell, Coach}` is **not a new architecture — it is a
truer description of the one we already have.** That single realisation removes most of
the pressure to build anything. The rest of this doc is about *meaning and restraint*,
not plumbing.

---

## 1. Should the bell stay `Engine → Media → playBell`, or become `Transition → {Bell, Coach}`?

**Recommendation: adopt the `Transition → {Bell, Coach}` *mental model*, keep the
*implementation* exactly where it is.**

The bell is the coach's peer, not a sound effect the coach triggers and not a leaf under
Media's UI. But we already have that: the shared "Transition" node is the EventBus, and
the bell is already a sibling subscriber. What changes is **conceptual ownership**, not
files:

- Stop thinking "the bell is a Media output." Start thinking "the bell is the second
  voice at the transition — the one that never uses words."
- The Coach voices the *behaviour* of a transition; the Bell voices the *fact* of it.

Why not literally introduce a `Transition` object or a `TransitionRuntime`? Because the
transition already exists as an engine event, fully typed, deterministic, and consumed by
both voices. A `Transition` abstraction would be a rename of `WorkoutEvent` with no new
capability — speculative complexity the prompt explicitly warns against.

There is **one** real seam worth naming: today the *mapping* "which event → which bell"
lives inside `MediaRuntime.onEvent`. That mapping is small and unambiguous (a transition
either happened or it didn't — no judgement), so Media is a fine host. Contrast the coach,
whose event→speech mapping requires silence gates, memory, and personality. **The bell
needs no judgement, so it needs no runtime of its own.** (See §4.)

---

## 2. What does the Bell own — and what stays the Coach's?

The dividing line: **the Bell owns time's *structure*; the Coach owns time's *meaning*.**
A gym bell has marked the same five moments for a century, wordlessly. Everything that
requires a *decision about the athlete* is the coach's.

| Moment | Owner | Why |
|---|---|---|
| Round start / **return to work** after rest | **Bell** | the archetypal "seconds out" — the body moves on the bell |
| Round **end** (→ rest) | **Bell** | *the* boxing bell: the sound that ends a round |
| Rest start | **Bell** (same instant as round end) | one transition, one ring |
| Workout complete | **Bell** (final bell) | the session's full stop |
| Final round *begin* | **Bell, optionally distinct** | tradition marks the last round; but risks noise — see trade-off |
| 30s / 10s warning | **Contested** — Bell *tone* or Coach *anchor*, not both | "thirty seconds" alone is information; "finish sharp" is behaviour |
| Per-second countdown (10,5,4,3,2,1) | **Neither should *speak* it** | see §5 — the bell resolves the countdown; numbers are a software-ism |
| "MOVE!", "hands home", combinations, encouragement | **Coach** | behaviour — never the bell |

Principles that fall out:

- **The Bell marks boundaries; the Coach fills spans.** The bell is an instant; the coach
  is an interval.
- **The Bell owns the skeleton, the Coach owns the muscle.** Remove the coach and the bell
  alone is still a recognisable boxing round. Remove the bell and the coach is a podcast.
- **The final-round and warning moments are the only genuinely debatable ones** — both sit
  on the boundary between structure (bell) and meaning (coach). Recommendation: give the
  *structure* of "last round" to a distinct bell only if user testing shows it aids
  immersion; give the *meaning* of "thirty seconds left, finish" to the coach as a rare
  behavioural anchor. Never voice the same moment twice (the LAW FOUR discipline from
  PR-028 applies across voices, not just within the coach).

---

## 3. Should the Bell have personalities?

**Recommendation: ONE bell by default. Personalise *intensity*, never *identity*. Any
timbre variation belongs to the ENVIRONMENT/product, not to the coach pack.**

The coach pack owns *how it is spoken*. The bell is not spoken — it is the room. Coupling
the bell to the coach pack conflates two orthogonal axes:

- **Coach pack** = the trainer in your corner (voice, words, intensity of speech).
- **Bell** = the venue you're training in (the gym, the ring).

A Fight Night coach in a traditional gym still hears a traditional bell. Binding a bell to
each of six packs would fork the one universal, century-old signal into six dialects and
weaken the archetype that makes it immersive.

Where variation *is* legitimate:

- **Intensity, not identity.** Calm's "gentler transitions" = the *same* bell, lower
  volume / softer attack — not a different instrument. One archetype, adjustable loudness.
- **Environment timbres (future, optional).** A "competition camp" product could ring a
  ring-side bell; an "old gym" environment a heavier gong. That's the *room* changing, not
  the coach. Keep it a small, product-level enum if it ever ships — not a per-pack field.

| Design | Pros | Cons | Verdict |
|---|---|---|---|
| One bell, fixed | maximal authenticity, zero config, universal | no expressive range | **default** |
| One bell + intensity (volume/softness) | Calm/immersion needs met, archetype intact | trivial extra param | **acceptable extension** |
| Environment timbres (product-scoped) | future products feel distinct | small enum to maintain | **later, if products demand** |
| Per-coach-pack bells | "cohesive" packs | forks the archetype, couples orthogonal axes, 6× assets | **reject** |

---

## 4. Where does the Bell belong: Media / Training / Coaching / Session / Transition / none?

**Recommendation: mechanism stays in the *Media Runtime*; meaning belongs to the
*Engine's transition layer*. No new runtime.**

- **Media Runtime — YES, as host.** The bell is Web Audio; audio unlock, autoplay policy,
  and synthesis already live here. Moving the *sound* out of Media buys nothing.
- **Transition management — YES, as meaning.** *What a bell means* (a boundary occurred) is
  already fully owned by the Engine's event stream. The bell is the audible face of that
  structure.
- **Coaching Experience — NO.** Behaviour is the coach's. The bell carries no behaviour.
- **Session Runtime — NO.** That layer is persistence/History; the bell is ephemeral.
- **Training Experience — as a *view*, yes** — "training experience" is the union of coach
  + bell + timer as the athlete perceives them, but it is not a code-owning layer.
- **A new BellRuntime — NO.** A runtime earns its existence by owning *judgement* (silence
  gates, memory, personality, ordering). The bell owns none: a transition is unambiguous
  and deterministic. A BellRuntime would be a ceremony around a switch statement.

Net: **the bell is produced by Media and meant by the Engine's transitions — the two
places it already lives.** The investigation's honest result is "leave it where it is, and
rename what we believe about it."

---

## 5. Are countdowns even desirable?

> **Shipped in PR-030** — the spoken numeric countdown was retired; the engine markers
> and preemption were retained. See [PRESENCE_AND_TRANSITIONS.md](./PRESENCE_AND_TRANSITIONS.md).

**Recommendation: the *spoken numeric* countdown ("3, 2, 1") should not be the default.
The bell resolves the countdown; the coach adds at most one behavioural word.** Keep the
engine's countdown *markers* (they are the coach's temporal skeleton), but stop *speaking
the numbers*.

Ranked by immersion (best → worst), against "put the phone down / behaviour beats
information / silence beats speech":

```
  silence → BELL → BELL + one behavioural word → (rare) behavioural anchor → spoken numbers
   ▲ the room                                                                  ▲ the app
```

- **"3, 2, 1" is a software-ism.** No gym counts you into a round out loud. Spoken numbers
  announce that a machine is timing you — the exact opposite of "forget the phone exists."
  They are *information* about the clock, not *behaviour*.
- **The bell IS the countdown's resolution.** A boxer's body already knows "seconds out."
  The ding does in one instinctive pulse what "three… two… one…" does in three cognitive
  ticks — and does it more authentically.
- **"30 SECONDS — FINISH SHARP" is behaviour, not counting** — legitimate, but it's a
  *coach anchor* (already exists), used rarely, because "finish sharp" changes what the
  athlete does. "Thirty seconds" *alone* is just a clock read-out; drop it.
- **The traditional 10-second warning** (the clacker) is the single place a *tone* beats
  *speech*: it warns without words. This is exactly what the latent, unused `'warning'`
  bell is for. Optional, off by default, environment-flavoured if ever enabled.

**Important non-removal:** `COUNTDOWN_SECOND` events must stay in the engine even if
unspoken — the coach uses them to avoid starting a line that the boundary would cut
(PR-021 preemption). "Remove countdowns" means *stop narrating numbers*, not *delete the
timing skeleton*. This keeps the change small and behaviour-only.

---

## 6. How the Bell plugs into the philosophy

- **`DINGGG!` communicates what speech shouldn't.** It is pre-verbal, universal, and
  instant — it triggers a *trained reflex* (move on the bell) at zero cognitive cost.
  That is "behaviour beats information" in its purest form: no sentence, pure action.
- **Silence can say more than another countdown.** Between rounds, silence + one bell tells
  the athlete "you are in a real round" precisely because nothing is chattering. Fill that
  space with "three, two, one" and you've reminded them of the phone.
- **Transitions become immersive by *restraint*.** A gym bell is authentic because it never
  decorates — it rings at the five moments and is otherwise silent. The bell's silence
  between transitions is part of its meaning.

**The final principle, applied to the Bell:**

> The Coach speaks only when silence would coach less effectively.
> **The Bell rings only when silence would mark the transition less effectively.**

The bell rings *only* at true structural boundaries — never to fill, count, decorate, or
celebrate. Its restraint is the design. One bell, at the moments a century of boxing has
rung it, and not one ring more.

---

## 7. Future products — does the Bell survive?

| Product | Round structure? | Bell behaviour |
|---|---|---|
| Heavy bag | yes | full bell (native home) |
| Pads / mitts | yes (rounds) | full bell |
| Sparring / competition camp | yes (rounds, ring bell) | full bell — most authentic |
| Shadow boxing | usually rounds | full bell |
| Skipping | often rounds/intervals | bell on intervals, or start/stop only |
| Roadwork | continuous | start/stop only, mostly silent |
| Mobility / rehab | continuous / cued | likely silent, or soft cue — not a fight bell |

**What this tells us about ownership:** the bell **survives exactly where round structure
survives, and fades where it doesn't** — independent of coach, independent of *which*
product. That is decisive: the bell is not owned by the heavy bag, not by the coach, not by
a product. **It is owned by the presence of round-structured time — i.e., the Engine's
transition model.** The same neutral engine transitions drive the bell in every
round-based product and simply stop occurring in continuous ones. A single, universal,
transition-driven bell scales across the entire future catalogue without change. A
per-product or per-coach bell would need re-authoring for each; the universal bell does
not. Universality is not just aesthetically right — it is the cheapest design.

---

## Sequence & transition diagrams

**Round → rest → next round (both voices off one transition):**

```
Engine        Bus            Coach Runtime         Media Runtime (Bell)       Athlete
  │ round ends │                   │                       │                    │
  ├ ROUND_COMPLETED ─────────────► (no speech)             │                    │
  ├ REST_STARTED ────────────────► rest_intro? (gated) ──► sink.speak           │
  │            └──────────────────────────────────────────► bell('rest-start') ─► DING → "rest"
  │            (rest span: coach mostly silent; bell silent)                     │
  │ rest ends  │                   │                       │                    │
  ├ ROUND_STARTED ───────────────► round_intro (brief) ──► sink.speak           │
  │            └──────────────────────────────────────────► bell('round-start')─► DING-DING → body moves
  │                                                                              │
  ▼ round span: Coach owns it (behaviour); Bell silent until the next boundary   ▼
```

**Transition state machine (who voices each edge):**

```
        ┌───────── bell: round-start (double) ──────────┐
        │                                               │
   [ REST ] ◄── bell: rest-start (single) ── [ ROUND ] ─┘
        │                                        │
        │                              bell: finish (triad) at last round end
        ▼                                        ▼
   (coach: sparse)                          [ COMPLETE ]
                                                 │
                              countdown edges = engine markers only
                              (coach may add ONE word; bell does NOT count)
```

---

## Alternative designs & trade-offs (summary)

| # | Design | Size | Immersion | Verdict |
|---|---|---|---|---|
| A | Status quo: bell = Media effect, coach speaks countdowns | smallest | medium (numeric countdowns break it) | keep mechanism, **fix the countdown philosophy (§5)** |
| B | **Reframe: Bell = transition voice, coach's silent peer; one bell; no spoken numbers; bell-led transitions** | ~same code, new philosophy | **highest** | **recommended** |
| C | BellRuntime + per-pack bell personalities | large | lower (forks archetype) | **reject** — no judgement to own, speculative |
| D | Bell owns countdowns/warnings/celebrations too | medium | lower (noisy) | **reject** — violates restraint |

Design **B** is the recommendation: it is essentially design **A** with (1) a corrected
belief about what the bell *is*, and (2) the countdown philosophy of §5. No new runtime, no
new abstraction, minimal code — the smallest design that makes the biggest experiential
difference.

---

## The four answers

**What is the Bell?**
The Bell is the *second coach — the one that never speaks*. It is the voice of time's
structure: a pre-verbal, universal signal that has marked boxing rounds for a century and
coaches by reflex rather than by information. It is the sound of the *room*, not the sound
of the *app*.

**What does it own?**
The structural skeleton of the session — the *boundaries*: round begin, round end, rest,
return to work, and the final bell. It owns the *instant a phase changes*, not what to do
about it (coach) nor how long it lasts (engine). It does **not** own countdowns, warnings
as information, celebration, or behaviour.

**Where does it belong?**
Produced by the **Media Runtime** (its mechanism) and *meant* by the **Engine's transition
events** (its meaning) — both places it already lives. It is the coach's peer subscriber,
not its output. **No new runtime, no new abstraction.**

**How does it make the athlete forget they are training with software?**
By being the gym instead of the app. It replaces machine countdowns and announcements with
a single instinctive signal the athlete's body already obeys, and it stays *silent* between
transitions — so its restraint is as immersive as its ring. Software counts; a gym rings.
The Bell rings only when silence would mark the transition less effectively — and in that
discipline, the phone disappears.

---

*No code was changed. The one behavioural recommendation with teeth is §5 (retire spoken
numeric countdowns in favour of the bell) — a small, coach-side, philosophy-level change to
be scoped as its own PR if accepted. Everything else is a change of belief, not of
architecture.*
