# Coaching Refinement — Cadence, Reinforcement & Time Awareness

A refinement *within* the existing Coach Runtime (no engine / event-runtime /
architecture redesign). The pipeline is unchanged — Director → Silence → Planner →
Queue → Sink — it now carries three coaching layers so the athlete feels a coach
present and paying attention, without being talked at. Deterministic, no randomness,
no AI.

---

## 1. Implementation summary

Added two coaching intents and the memory to drive them, all in `src/lib/coaching/`:

- **Layer 1 — Structural** (unchanged): intros, round/rest starts, countdown, finish. Exact, never delayed.
- **Layer 2 — Time anchors** (`time_anchor`, new): personality-voiced orientation ("One minute remaining. Stay disciplined."). Authored content — the engine schedules them; the runtime voices them.
- **Layer 3 — Reinforcement** (`reinforcement`, new): a repeated coaching dimension is re-said with fresh wording instead of the identical line.

New files: `anchors.ts` (anchor kinds, per-personality banks, id parsing), `reinforcements.ts` (dimension taxonomy, classifier, phrase pools). Touched: `CoachAction` (intents/priority/sets), `ConversationState` (per-round dimension memory), `CoachDirector` (anchor + reinforcement routing), `SpeechPlanner` (bank rendering), `SilenceController` (reinforcement pacing), and the integration mapper (`workout-config.ts`) to inject default anchors.

---

## 2. Cadence model

The coach speaks in waves, not on a timer. Cadence is an emergent property of three
existing/added mechanisms — no fixed intervals are introduced:

- **Structural beats** anchor the round (round start → … → countdown → bell).
- **Authored technique cues** land at their authored times (the engine schedules them).
- **Time anchors** fill the long quiet stretches with orientation, so a 3-minute round is never silent for 90s.
- The **SilenceController** spaces every coaching line (density gap, personality-scaled), keeping speech sparse.

Silence stays a first-class tool: anchors are *sparse* (a few per round) and technique
cues are gap-limited, so a typical round is ~85–90% silent — well inside the "60–70%
quiet" budget (verified: < 12 spoken lines/minute across a 9-minute session).

---

## 3. Reinforcement strategy

A cue is classified into a **dimension** (guard, distance, footwork, breathing, rhythm,
power, head, output, general). The **first** time a dimension is taught in a round, the
authored line is spoken verbatim (authored content respected). Any **later** same-dimension
cue that round is voiced from that dimension's reinforcement pool — same lesson, new words —
rotated deterministically. Identical wording is never repeated (existing recent-text dedup +
rotation).

```
Keep your hands high   → (authored, verbatim)
Hands up               → "Don't let them drop."   (guard reinforcement #1)
Guard tight            → "Protect yourself."       (guard reinforcement #2)
```

Dimension memory resets at each round start (a new round is a fresh focus).

---

## 4. Time anchor implementation

Anchors are **authored content, not runtime timing logic** — respecting the constraints:

- An anchor is a cue with a reserved id (`anchor-onemin`, `anchor-twomin`, `anchor-thirty`, `anchor-halfway`, `anchor-twenty`). The engine schedules it like any cue and emits `COACH_CUE`; the Director recognises the id and routes to `time_anchor`; the Planner voices it from the coach's anchor bank.
- The integration mapper (`toWorkoutConfig`) **injects sensible defaults** for rounds long enough (two-minute ≥ 2:45 rounds, one-minute ≥ 1:30, thirty ≥ 0:55), skipping any the author placed and any that would clash with an authored cue or the countdown. So every existing workout gains time-awareness while authors can still hand-place anchors.
- Anchors join the trust skeleton (always spoken, priority 66 — above technique cues, below the intros/countdown), so orientation always lands but the countdown still wins the air.

---

## 5. Conversation memory

`ConversationState` gained a per-round `roundTaughtDimensions` set: which dimensions have
been taught this round. It drives reinforcement (teach once verbatim, then vary) and keeps
coaching varied — a dimension just taught is reinforced with new wording rather than
repeated. It is lightweight (a `Set` of ≤9 values), resets per round, and never mirrors
engine state. Deterministic; survives pause/resume (memory isn't cleared on pause).

---

## 6. Personality integration

Anchor lines inherit the coach. Same event, six performances (one-minute anchor):

| Coach | Line |
|---|---|
| Technical | "One minute remaining. Stay disciplined." |
| Old School | "One minute! Don't give it away!" |
| Fight Night | "One minute! This round is yours!" |
| Calm | "One minute left. Stay easy." |
| Competition | "One minute. Championship rounds." |
| Southpaw | "One minute. Make him chase." |

Each bank rotates for cross-round variety. Reinforcement pools are boxing content shared
across coaches (the *lesson* is universal; the anchor *voice* is personal).

---

## 7. Test summary

**11 new tests** (`src/tests/coaching/cadence.test.ts`), all deterministic and headless
(223 total, all green):

- Time anchors voiced; **different performance per coach** (exact lines).
- Reinforcement: first verbatim, later same-dimension reinforced with fresh wording; **no identical repetition**; a different dimension is taught on its own; **per-round reset** (verbatim again next round).
- **Presence**: anchors land ≥ 3× through a real workout (no starvation).
- **Silence budget**: < 12 spoken lines/minute; silence decisions made.
- **Determinism** through the whole engine → coach path (identical twice).
- **Resume after pause**: dimension memory survives; reinforces after resume; no replay.
- **Mapper**: injects anchors for long rounds, none for short rounds, output stays engine-valid (strictly increasing, in range).

All existing coaching/runtime/media tests continue to pass unchanged.

---

## 8. Before vs after

**A long round, sparse authored cues.**

- **Before:** round start → (authored cue) → … a long silence … → (authored cue) → countdown. On a 3-minute round the athlete could go 60–90s with nothing, wondering if the app stalled.
- **After:** round start → cue → **"Two minutes to go. Stay precise."** → cue → **"One minute remaining. Stay disciplined."** → cue → **"Thirty seconds. Sharpen up."** → countdown. Present throughout, still ~85% silent.

**Repeated coaching.**

- **Before:** "Keep your hands high." … "Keep your hands high." … "Keep your hands high." — robotic (or dropped by dedup).
- **After:** "Keep your hands high." … "Don't let them drop." … "Protect yourself." — same lesson, a coach who isn't a recording.

**Same workout, two coaches (one-minute mark).**

- Fight Night: *"One minute! This round is yours!"*  ·  Calm: *"One minute left. Stay easy."* — identical event, unmistakably different corner.
