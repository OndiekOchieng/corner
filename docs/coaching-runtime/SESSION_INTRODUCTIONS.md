# Session Introductions — Design (PR-020)

**Status:** Proposed. Design + product decision, no implementation. Specifies how a
workout's opening becomes its own authoring concept — owned by the Coach Pack, fed by
workout *facts* — without touching the Engine, Event Runtime, or the browser boundary.

Related: [PERSONALITY_SYSTEM.md](../coaching/PERSONALITY_SYSTEM.md) ·
[VOICE_GUIDELINES.md](../product/VOICE_GUIDELINES.md) ·
[VOICE_READINESS.md](VOICE_READINESS.md)

---

## Current pipeline (as-is)

The opening line already exists and is **already owned by the Coach Pack** — the
workout supplies only its name. The improvement is to give it *structure* and remove
hard-coded time wording.

```
CoachDirector.onEvent(WORKOUT_STARTED)                     src/lib/coaching/CoachDirector.ts:45
   → DirectedIntent { intent: 'workout_intro',
                      params: { workoutName, totalRounds } }   ← only name + rounds today
   → CoachRuntime.consider → SpeechPlanner.plan('workout_intro', params)
        → composedKey('workout_intro') → 'workout_intro'    src/lib/coaching/SpeechPlanner.ts:65
        → fromBank(profile.banks.workout_intro)             rotate a variant, deterministic
        → fill(): {name} → workoutName                      SpeechPlanner.ts:50-58
   → QueueManager (structural, priority 85)                 CoachAction.ts:56
   → SpeechSink → SpeechService.speak()
```

**Where authored:** `src/lib/coaching/personalities.ts` — each pack's
`banks.workout_intro` array (rotated variants). **Who owns it:** the Coach Pack.
**How it reaches the planner:** Director emits the `workout_intro` intent → Planner
draws from the pack's bank and fills `{name}`.

```
sequence (as-is)

Engine            CoachDirector        SpeechPlanner        personalities.ts       Sink
  │ WORKOUT_STARTED    │                    │                      │                 │
  │───────────────────▶│                    │                      │                 │
  │        intent workout_intro {name}      │                      │                 │
  │                    │───plan(intro)─────▶│                      │                 │
  │                    │                    │──banks.workout_intro▶│                 │
  │                    │                    │◀── ["{name}. Tonight we train…", …]     │
  │                    │                    │ rotate + fill {name}→workoutName        │
  │                    │◀───── text ────────│                      │                 │
  │                    │─────────────────────────── speak(text) ──────────────────▶ │
```

## Two problems

1. **Flat wording.** `workout_intro` is a single bank of full sentences. There is no
   structured notion of *greeting*, *opening framing*, *objective*, or *transition* —
   so a pack can't, say, voice the workout's focus and then hand off to round one.
2. **Hard-coded time.** Fight Night's variant (`personalities.ts:102`) says
   *"{name}. Tonight we train like it's the real thing…"* — spoken at 7 a.m. it breaks
   immersion. Time is baked into a string instead of being conditional data.
3. **Facts aren't available.** The Director passes only `workoutName`/`totalRounds`
   (`CoachDirector.ts:50-53`); a workout's *objective* and *focus* never reach the
   coach, so the opening can't speak them even though they'd make the best intro.

## Separating content from framing

The core principle (see [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) §5:
*coaching is policy, not execution*):

| Concern | Owner | Provides |
|---|---|---|
| **Workout content (facts)** | the Workout | `objective`, `focus`, `difficulty`, `name`, `stance` — *what* the session is |
| **Session framing (voice)** | the Coach Pack | *how* those facts are spoken — greeting, opening, how the objective is phrased, the hand-off |

A workout states *"focus: footwork and range; objective: stay composed under pressure."*
The Technical coach says it one way, Fight Night another, Calm another — **same facts,
different human.**

## The `SessionIntroduction` authoring concept

Replace the flat `workout_intro` bank with a structured, per-pack block of ordered,
individually-rotated segments:

```ts
interface SessionIntroduction {
  readonly purpose: string;                 // authoring note — NOT spoken; documents intent
  readonly personality: CoachPackId;        // which pack this belongs to
  readonly greeting?: readonly string[];    // optional, may be time-aware (see below)
  readonly opening: readonly string[];      // the pack's signature framing
  readonly objective: readonly string[];    // voices the workout's {objective}/{focus} facts
  readonly transition: readonly string[];   // hands off to the first round
}
```

- Each field is a **bank of rotated variants** (same determinism as today — rotation
  counters, never RNG).
- New placeholders for the `objective` segment: `{objective}`, `{focus}` — filled from
  workout facts, exactly as `{name}` is filled today (`SpeechPlanner.fill()`).
- The Introduction Planner composes `[greeting?] + opening + objective? + transition`
  into one or more `workout_intro` actions before the first round. Segments a pack
  omits (e.g. no greeting) are simply skipped — total order preserved.
- Backwards compatible: the existing `workout_intro` bank maps to `opening`; adding
  the other segments is incremental, pack by pack.

Example (illustrative authoring, not final copy):

```
Technical.introduction = {
  purpose:   "Set a precise, craft-first tone; name the technical objective.",
  opening:   ["{name}. Precision first — we build it clean today."],
  objective: ["Today's focus: {focus}. Keep it honest.", "We're sharpening {focus}."],
  transition:["Round one coming up. Let's get to work."],
}   // no greeting — Technical never opens with hello or time of day
```

## Time awareness

| Option | Description | Verdict |
|---|---|---|
| **A** | Morning/Afternoon/Evening variants everywhere | ✗ risks being *wrong* (the current "Tonight" bug, generalized); pushes wall-clock into the coach |
| **B** | Neutral wording that works at any hour | ✓ safe + immersive forever, but a little less warm |
| **C** | Coach-pack dependent — Technical never references time; Fight Night *may* say "tonight"; Calm *may* say "Good morning" | ✓ best expresses personality *and* avoids universal wrongness |

**Recommendation: Option C, with two hard constraints** (prioritising immersion and
longevity over novelty):

1. **Time is injected data, never read in the coach.** The Coach Runtime is
   deterministic — it must not call `Date.now()`. Time of day enters as an injected
   value on the intro params / `CoachContext`:
   `timeOfDay: 'morning' | 'afternoon' | 'evening' | null`. The composition (React
   edge) supplies it; the coach only *reads* it. Determinism is preserved (same inputs
   → same intro).
2. **Neutral by default; time is a rare, opt-in flourish with a neutral fallback.** The
   `greeting`/`opening` banks default to timeless wording. A pack that opts into time
   provides *conditional* variants selected only when `timeOfDay` matches, and a
   neutral variant is always present for `null`/mismatch. A time reference can never be
   "wrong" because it only fires on real, matching data.

This fixes the "Tonight" bug at the root: Fight Night's evening line becomes a variant
guarded by `timeOfDay === 'evening'`, with a neutral opening otherwise.

## Personality ownership (confirmed)

The introduction belongs to the **Coach Pack**, not the workout:

- **Workout defines** (facts, added to the type): `objective`, `focus` — alongside the
  existing `name`, `difficulty`, `stance`.
- **Coach Pack defines** (voice): the `SessionIntroduction` block — how those facts are
  greeted, framed, and handed off.

The Director's job is only to pass the facts through; it gains `objective`/`focus` in
the `workout_intro` params (a Coach-Runtime-side change — **no Engine change**, the
facts ride on `CoachContext`, which the composition already populates from the workout).

## Proposed wiring

```
Workout (facts: name, objective, focus, difficulty)
   │  facts ride on CoachContext (composition populates it — no Engine change)
   ▼
Coach Runtime
   │   CoachDirector.onEvent(WORKOUT_STARTED)
   ▼
Introduction Planner            ← NEW: composes SessionIntroduction segments
   │   [greeting? · opening · objective? · transition] using pack banks + workout facts
   │   + injected timeOfDay (neutral fallback); tags action requiresVoice:true
   ▼
Voice Readiness Gate            ← policy from VOICE_READINESS.md (bounded wait owned by Media)
   │   holds only the intro utterance until voiceReady() or ~800ms fallback
   ▼
Speech Planner                  ← rotates variants, fills {name}/{objective}/{focus}
   ▼
Queue                           ← structural priority (85), never dropped
   ▼
SpeechSink                      ← the narrow port (unchanged)
   ▼
SpeechService                   ← speaks in the now-resolved coach voice
```

### Ownership boundaries
- **Workout** → facts only (`objective`, `focus`). No voice, no framing.
- **Coach Runtime** → owns the Introduction Planner and the *policy* of gating the
  intro; stays pure (no timers, no browser, no `Date.now()`).
- **Media Runtime** → owns the actual bounded voice-readiness wait and speech.
- **Engine / Event Runtime** → **unchanged.** The intro rides existing events and
  `CoachContext`.
- **No browser API leakage** — readiness is consumed via the browser-free
  `VoiceReadiness` port.

## Smallest follow-up implementation PR

The design splits into independent, shippable slices (do them in this order):

1. **Voice Readiness gate** (from [VOICE_READINESS.md](VOICE_READINESS.md)) — fixes the
   visible voice bug; media/speech layer only.
2. **De-hardcode time** — make Fight Night's evening line a `timeOfDay`-guarded variant
   with a neutral fallback; inject `timeOfDay` into intro params. Small, coaching-data
   only.
3. **Structured `SessionIntroduction`** — add `objective`/`focus` to the workout type,
   the `SessionIntroduction` block to personalities, and the Introduction Planner.
   Largest slice; do last, pack by pack, backwards-compatible with the existing bank.
