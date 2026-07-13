# PR-009 — Coach Runtime: Implementation

The Coach Runtime turns the engine's immutable event stream into intentional
coaching behaviour, then hands resolved lines to the existing SpeechService. It
decides **whether** to speak, **what** to say, and **when** — it does not decide,
execute, or synthesize. This document is the full deliverable set (§1–§12).

```
Execution Engine → Event Runtime → Coach Runtime → Speech Service
```

Everything lives in `src/lib/coaching/`, is pure/deterministic, and runs with no
browser APIs. All timing is the engine's `elapsedMs`, never a wall-clock.

---

## 1. Implementation Summary

A new, self-contained module orchestrates the coaching systems already designed
(Coach Performance, Timing Model, Silence Guide, Motivation Model, Conversation
Patterns, Cue Library, Coach Packs). It plugs into the existing Event Runtime as
an ordinary `Subscriber` — **no Engine, Host, Event Runtime, Session, or Speech
changes**.

**Files (`src/lib/coaching/`):**

| File | Role |
|---|---|
| `CoachAction.ts` | Intents, priorities, the `CoachAction` value, the `SpeechSink` port |
| `CoachContext.ts` | Personality + tunable thresholds (`CoachConfig`) |
| `ConversationState.ts` | Lightweight mutable coaching memory + immutable snapshot |
| `personalities.ts` | The six Coach Packs as behavioural knobs + phrase banks |
| `CoachDirector.ts` | Event → candidate coaching intent(s); cue classification |
| `SpeechPlanner.ts` | Intent → the actual line (banks + rotation; verbatim cues; number words) |
| `SilenceController.ts` | The Silence Guide, made mechanical — speak or stay quiet |
| `PriorityResolver.ts` | Deterministic priority + interruption rules |
| `CoachActionQueue.ts` | Priority-ordered buffer primitive (storage) |
| `QueueManager.ts` | Queue policy: enqueue/replace/discard/expire/flush/drain |
| `CoachDiagnostics.ts` | Immutable metrics snapshots |
| `CoachRuntime.ts` | The orchestrator that owns coaching judgement |
| `CoachRuntimePlugin.ts` | `Subscriber` wrapper + factory + SpeechService sink adapter |
| `index.ts` | Public surface |

**Wiring (one line, when the app opts in — see §12):**
```ts
bus.register(createCoachRuntimePlugin({
  personality: 'fightnight',
  sink: speechServiceSink(speechService),
  workoutName: 'Orthodox Power',
}));
```

**Status:** 31 new tests (181 total), all green. `tsc` adds zero new errors
(only the pre-existing unrelated `useWorkoutBuilder` remains). The Engine is
untouched.

---

## 2. Coach Runtime Architecture

The runtime is a synchronous pipeline invoked once per engine event:

```
                        ┌─────────────── CoachRuntime.onEvent(event) ───────────────┐
 WorkoutEvent  ──▶  replay guard ──▶ control? ──▶ CoachDirector ──▶ [candidates]     │
                                        │              (what shape of reaction?)     │
                                        │                    │                       │
                                        ▼                    ▼  per candidate        │
                                   sink.pause/          SilenceController            │
                                   resume/cancel         (speak at all?) ──hush──▶ ✕ │
                                        │                    │ speak                  │
                                        │              SpeechPlanner                  │
                                        │              (which words? + dedupe)        │
                                        │                    │                        │
                                        │              QueueManager.enqueue           │
                                        │                    │                        │
                                        └──────────▶  QueueManager.drain(sink) ───────┘
                                                             │
                                                        SpeechSink (SpeechService)
```

**Layering & dependencies.** The module depends only on engine *types*
(`WorkoutEvent`, `RoundConfig`) — type-only imports that erase at build. It never
imports the engine runtime, React, or the speech-synthesis API. The one seam to
speech is the narrow `SpeechSink` port; `speechServiceSink()` adapts the existing
SpeechService structurally (no import → no coupling, and the service is neither
rewritten nor bypassed).

**Determinism.** No `Date.now`, no `performance.now`, no `Math.random`. Variety
comes from deterministic rotation counters; timing from the event's `elapsedMs`.
The same event stream always yields byte-identical coaching (proved by tests).

---

## 3. Conversation Model

`ConversationState` is the coach's memory. It exists **only to improve coaching**
and deliberately does **not** mirror engine state (no remaining-time, no phase
machinery — those are read from events).

It tracks: current round, total rounds, energy (`low·calm·steady·rising·peak`),
last intent, last-spoken elapsed, **last-coaching elapsed** (structural intros
don't count), last-correction elapsed, last-encouragement elapsed, a small ring
buffer of recent texts (dedup), per-reminder-text timestamps, and deterministic
rotation counters.

Two modelling decisions matter:

- **Structural vs. coaching lines.** Round intros, countdown, and finish are the
  *trust skeleton* — they never count toward coaching density. The density gap is
  measured against the last *coaching* line only, so a round intro immediately
  before an authored cue never suppresses that cue (a bug caught and fixed during
  implementation).
- **Commit-on-decide.** When a candidate is committed, memory is updated
  immediately so later candidates in the *same* event batch (e.g. the rest
  teaching line after the rest intro) space themselves correctly.

The immutable `ConversationSnapshot` is what the SilenceController and Planner
read — they can never mutate conversation state.

---

## 4. Queue Strategy

Two collaborators: `CoachActionQueue` (a priority-ordered buffer — pure storage)
and `QueueManager` (all policy). Operations:

- **enqueue** — insert in priority order; **replace** an unspoken same-intent line
  (freshest wording wins); **discard** the lowest-priority overflow past
  `maxQueueDepth` (default 4).
- **expire** — drop actions whose engine-elapsed TTL has passed (used for the
  short-lived urgency line).
- **flush** — drop everything (resume / cancel), so stale coaching never replays.
- **drain** — expire, then render in priority order to the sink.

**Interruption.** A *critical* action (countdown, finish) that outranks the
last-rendered line calls `sink.cancel()` first — so the countdown cuts through
lingering chatter exactly once ("Ten seconds"), then the following numbers share
priority and never cancel each other. This is the mechanism by which *the count
wins the air* (TIMING_MODEL.md §7).

**Why drain-per-event works.** The SpeechService already serialises playback and
never overlaps. The runtime therefore hands ordered lines to the sink each event;
the queue's job is ordering, replacement, expiry, interruption, and flush — not
re-implementing playback timing. `peakQueueDepth` is tracked for diagnostics.

**No replay.** Events with `seq ≤ lastSeq` are ignored (replays), `WORKOUT_RESUMED`
flushes pending, and the engine's restorer already withholds pre-cursor events —
three independent guarantees that resume never re-speaks the past.

---

## 5. Silence Strategy

`SilenceController.decideSilence()` is the Silence Guide made mechanical: it
decides *before any words are chosen* whether an intent earns its moment.

- **Trust skeleton always passes** — workout intro, round intro, rest intro,
  countdown, finish. The athlete relies on them.
- **Instruction / reminder** — must clear a coaching-density gap
  (`minCoachingGapMs`, default 5 s, scaled by personality). Reminders also dedupe
  exact wording within `reminderCooldownMs`.
- **Correction** — allowed sooner (`minCorrectionGapMs`) but never stacked.
- **Encouragement** — earned and rare: on a cooldown (default 45 s), **never right
  after a correction** (Motivation Model §3), and reticent coaches hold more.
- **Urgency** — earned, final-round only, with a little air in front; expires fast
  so the countdown wins.
- **Teaching** — paced by cadence (not every rest), and lives *alongside* the rest
  intro in the rest window.

**Personality scales silence.** `gapScale = 1.8 − talkativeness`: Calm (0.25) →
×1.55 (more air); Fight Night (0.85) → ×0.95 (less). So the *same* stream yields
a chattier or quieter session by coach.

Every hush is counted (`silenceDecisions`) — silence is a first-class, observable
outcome, not the absence of one.

---

## 6. Priority Rules

A single total order, fixed and deterministic (`INTENT_PRIORITY`):

```
countdown 100 · finish 95 · workout_intro 85 · warmup 80 · round_intro 78 ·
rest_intro 72 · urgency 60 · correction 52 · instruction 44 · reminder 40 ·
teaching 34 · recovery 30 · encouragement 22
```

- **Critical wins & interrupts:** only `countdown` and `finish` may cut current
  speech, and only when they outrank the last-rendered line.
- **compare():** priority desc → earlier creation → seq. Fully deterministic; never
  depends on insertion timing.
- **Competition example:** an urgency push and the "Ten seconds" count compete at a
  final-round boundary; the count (100) outranks urgency (60) and interrupts it —
  the coach clears the air and the count lands clean.

---

## 7. Personality Integration

The six Coach Packs are `PersonalityProfile` data (matching
`PERSONALITY_SYSTEM.md`), each with:

- **Behavioural knobs** — `talkativeness` (scales silence gaps) and
  `encouragementBias` (how readily earned praise fires). These make personalities
  *behave* differently, not merely sound different.
- **Phrase banks** — several variants per composed line (workout/round/rest intros,
  recovery, teaching, encouragement, urgency, finish), rotated deterministically
  so the coach never loops.

**What varies vs. what doesn't.** Authored cue text (instruction/reminder/
correction) is spoken **verbatim** — the Cue Library already chose those words.
Countdown renders exact number words. Everything *composed* is personality-voiced.
The result: identical events, a different session per coach — Technical is precise
and sparing; Old School is blunt and quiet; Fight Night is loud and encouraging;
Calm leaves the most air; Competition holds a demanding standard; Southpaw talks
outside-foot and angles. Proven by tests asserting distinct output and coach-true
vocabulary on the same stream.

---

## 8. Diagnostics Overview

`CoachDiagnostics` exposes immutable snapshots and never affects behaviour:

| Metric | Meaning |
|---|---|
| `actionsGenerated` | candidates that became actions |
| `actionsSpoken` | lines rendered to the sink |
| `actionsDiscarded` | replaced/overflowed/flushed |
| `actionsExpired` | dropped by TTL |
| `silenceDecisions` | times the coach chose to stay quiet |
| `interruptions` | critical cuts of lower speech |
| `repetitionAvoided` | duplicate wordings suppressed |
| `queueDepth` / `peakQueueDepth` | buffer occupancy |
| `averageCoachingDensity` | spoken lines per minute of elapsed |
| `spokenByIntent` | histogram by intent |

Exposed via `plugin.diagnostics()` / `runtime.diagnosticsSnapshot()`. Density uses
`elapsedMs`, so it too is deterministic.

---

## 9. Test Summary

**31 new tests** (`src/tests/coaching/`), all deterministic and browser-free
(181 total across the app):

- **`units.test.ts` (17)** — cue classification; priority ordering & interruption;
  planner (number words, verbatim cues, rotation-variety, personality difference);
  queue (replace/discard/expire/flush/drain/interrupt); silence (skeleton always
  speaks, density spacing, earned/after-correction encouragement, teaching cadence).
- **`runtime.test.ts` (10)** — full-workout conversation flow; verbatim cues (and a
  cue correctly *held* when it collides with the countdown); no duplicated coaching;
  interruptions; intentional silence; **determinism** (identical output twice);
  **personality difference** on identical events; resume/replay safety (pause/resume
  sink control, stale-seq ignored, fresh `WORKOUT_STARTED` re-introduces).
- **`plugin.test.ts` (4)** — integrates on the real EventBus; distinct sessions per
  coach on identical events; determinism across independent runs; `speechServiceSink`
  maps operations (`clearPending → clearQueue`).

Covers every item the PR asked to verify: conversation flow, silence, priority,
queue, interruptions, repetition avoidance, round transitions, rest coaching,
finish coaching, workout intros, personalities, speech generation, no-duplication,
no-replay-after-resume, deterministic output — all without browser APIs.

---

## 10. Performance Notes

- **O(1)–O(n·log n) per event**, n = pending queue depth (≤ `maxQueueDepth`, 4).
  The only sort is on the tiny pending buffer; everything else is map/array ops.
- **Synchronous & allocation-light.** One event → at most a couple of candidates →
  a couple of small objects. No async, no timers, no polling (the old CoachEngine
  path polled every render/tick; this is purely event-driven).
- **No wall-clock reads.** Avoids `performance.now()` entirely — cheaper and
  deterministic.
- **Memory bounded.** Recent-text ring buffer (default 5), a per-reminder-text map
  and rotation map that only grow with distinct wordings (tens of entries), reset
  each session. Diagnostics are counters + one small histogram.
- **Runs early (priority 100).** Coaching is enqueued before Bell/Stats/Logger so
  speech starts promptly; delivery is isolated per subscriber by the EventBus.

At workout scale (~dozens of events) the runtime's cost is negligible relative to
speech synthesis itself.

---

## 11. Risks

| # | Risk | Severity | Mitigation / status |
|---|---|---|---|
| R1 | **Not yet wired into the live app.** The plugin exists and is tested on the real bus, but the UI still uses the PR-001 CoachEngine path. | P1 | Wiring is PR-010 (§12). Deliberately out of scope: swapping the live coach path touches app composition. |
| R2 | **Cue↔countdown collisions depend on authored timing.** A cue placed inside the final countdown window is (correctly) suppressed; poor authoring could silence intended cues. | P2 | Correct behaviour per Timing Model; Authoring Guide already warns to clear the countdown. Consider an authoring lint. |
| R3 | **Cue classification is heuristic.** `classifyCue` uses keyword sets; an unusual cue could be mis-tagged (e.g. reminder vs. instruction). | P3 | Only affects silence/priority nuance, never correctness of the words (cues are verbatim). Could move to authored cue metadata later. |
| R4 | **Config thresholds are hand-tuned.** Gaps/cooldowns are sensible defaults, not field-validated. | P2 | All in `CoachConfig`, overridable per deployment; tune during Beta with diagnostics (density). |
| R5 | **Two coach paths coexist** (CoachEngine + Coach Runtime) until R1 lands. | P2 | Register only one subscriber; documented. |
| R6 | **Personality banks are finite.** Very long/looping sessions could exhaust variety in a bank. | P3 | Rotation degrades gracefully (cycles); banks are easily extended without code change. |

None of these are regressions — the Engine and all stable systems are untouched.

---

## 12. Follow-up: PR-010 (Execution Continuity & Beta Readiness)

Recommended scope for the next PR:

1. **Wire the Coach Runtime into the live app.** Register
   `createCoachRuntimePlugin({ personality, sink: speechServiceSink(speechService) })`
   on the Host Runtime's EventBus and retire the ad-hoc CoachEngine polling in the
   active-workout page. One subscriber, no engine change.
2. **Coach selection → personality.** Surface a coach-pack choice (PR-008 flagged
   coach identity as presence-only) and pass it as `personality`. This makes "the
   athlete chose a coach" real end-to-end.
3. **Continuity across background/lock/resume.** Verify the runtime + SpeechService
   keep coaching alive when the screen sleeps (ties to PR-008 risk R3); confirm the
   resume path (SessionRestorer withholds pre-cursor events) produces no replayed
   coaching in the wired app.
4. **Beta tuning via diagnostics.** Expose `CoachDiagnosticsSnapshot` in a debug
   view; tune `CoachConfig` (density, cooldowns) against real sessions — target the
   Cue Library's ~1 coaching line / 20–40 s.
5. **Personality QA pass.** Read every bank aloud per `QUALITY_CHECKLIST.md`; expand
   variants where a long session would loop.
6. **Optional:** authored cue metadata (category/energy) to replace the heuristic
   classifier, and an authoring lint for cue↔countdown collisions (R2).

**Success criterion (unchanged):** the athlete forgets they are listening to
software and feels a knowledgeable coach in their corner — the right thing, at the
right time, for the right reason, with intentional silence, in a recognisable
voice, deterministically, and with the Engine untouched.
