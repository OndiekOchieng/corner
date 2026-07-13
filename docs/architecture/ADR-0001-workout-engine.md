# ADR-0001 — Deterministic Workout Engine

- **Status:** **ACCEPTED as baseline** by ARB on 2026-07-12, *with amendments* (see §Amendments). Design approved to implement per `IMPLEMENTATION_PLAN.md`.
- **Date:** 2026-07-12
- **Decision drivers:** `docs/AUDIT.md` (P0-3, P0-4, P1-1, P1-7), PR-001 retro, product thesis ("Corner is a coach, not a timer")
- **Supersedes the runtime behaviour of:** `hooks/useWorkoutEngine.ts`, `hooks/useRAFTimer.ts`
- **Related docs:** `ENGINE.md`, `STATE_MACHINE.md`, `EVENT_MODEL.md`, `IMPLEMENTATION_PLAN.md`, `ARCHITECTURE_REVIEW.md`, `ADR-0002` (deferred), `DECISIONS.md`
- **Determinism contract:** remains **(D1) fixed-timeline determinism** (a fixed `WorkoutConfig` + elapsed time). The generalized (D2) input-log model is **deferred** with ADR-0002.

---

## 1. Context

Corner's product promise is: **press Start, throw the phone on the floor, finish the workout without touching the device.** That makes workout *execution* — not the UI — the core system, and it must be **deterministic**: the coaching a user hears must be a pure function of the workout definition and elapsed wall-clock time, independent of frame rate, tab visibility, or device sleep.

The current implementation does not meet this bar. From the audit and the PR-001 integration work we know:

| Concern | Root cause in today's code |
|---|---|
| Duplicate timer events | `onComplete` is called inside a `setState` updater with no latch (`useRAFTimer.ts:53-62`); fires every frame once `remaining` hits 0. |
| Non-deterministic phase completion | Three overlapping reset paths (`useWorkoutEngine.ts:86,92` + `:113-121` + `useRAFTimer.ts:69-80`) race during completion. |
| Warmup is not first-class | `WARMUP` exists in the enum but is unreachable; PR-001 had to *announce* warmup as a stopgap. |
| Countdown coupled to timer cadence | Countdown is derived by polling `Math.ceil(timeRemaining)` each frame; correctness depends on 1 Hz-ish ticks. |
| No wake lock | Screen sleeps → rAF suspends → timer freezes → coaching stops. |
| Incomplete finish statistics | Completion is announced but no immutable session summary exists; `/finish` reads the wrong params. |
| Unclear timer ownership | Time is owned partly by `useRAFTimer` (counts down), partly by `useWorkoutEngine` (resets it), and consumers reach into both. |

PR-001 deliberately made the **CoachEngine idempotent** so that *duplicate speech* is impossible even while these engine defects remain. That was the right tactical call, but it masks — it does not fix — the underlying non-determinism. This ADR fixes the source.

## 2. Goals & non-goals

**Goals**
1. One module owns time, state, and transitions. Everything else derives.
2. Workout execution is a pure function of `(WorkoutConfig, elapsedMs)`.
3. Discrete moments (round start, cue, countdown, completion) are delivered as **events**, exactly once, in a defined order.
4. Correct behaviour across background tabs, sleep, and phone lock.
5. A subscriber seam that supports Coach, Bells, UI, Stats, Wake Lock, and *future* consumers (Watch, HR, AI Coach) **without changing the engine**.
6. Fully testable with a fake clock; no reliance on real timers or the DOM.

**Non-goals (this PR)**
- No implementation. This PR ships design docs only.
- No Wake Lock implementation (design the seam; build later).
- No new product features. No UI redesign.
- No cloud/analytics/wearable code — only proof that the architecture *admits* them.

## 3. Architecture review (current state)

```
UI (active/page.tsx)
  ├─ reaches into useWorkoutEngine (phase, currentRound, timeRemaining) — read
  ├─ reaches into useWorkoutEngine (play/pause/resume/quit) — write
  ├─ polls timeRemaining every render → derives cues + countdown itself
  └─ calls CoachEngine.* + bells directly (effect-based boundary detection)

useWorkoutEngine  ── owns phase + currentRound
  └─ useRAFTimer  ── owns timeRemaining, calls onComplete (unlatched)
```

Problems: **shared mutable time** across two hooks; **business logic in the view** (the page decides when cues/countdowns happen); **effect-polling** instead of events; **no session/statistics**; **no single source of truth**. Every future subscriber (Watch, Stats, AI) would have to re-derive workout logic from raw `timeRemaining`, duplicating the exact fragility we have today.

## 4. Alternative designs considered

### Option A — Keep the per-frame countdown counter (status quo, hardened)
Latch `onComplete`, collapse the reset paths, keep decrementing `timeRemaining` each frame.
- **Pros:** smallest change; familiar.
- **Cons:** time is still a *mutated accumulator* → drift compounds; background throttling still freezes progression; multi-phase catch-up after sleep is impossible (you can only decrement one frame at a time); countdown remains cadence-coupled; still no clean event/subscriber model. **Rejected** — it patches symptoms, not the model.

### Option B — Anchor + on-the-fly phase reducer
Store `phaseStartedAt = now()` and `phaseDurationMs`; each tick compute `remaining = duration - (now - start - pausedAccum)`; transition when `remaining <= 0`.
- **Pros:** time becomes *derived*, not accumulated → no drift; pause is exact (accumulate paused time); resilient to dropped frames within a phase.
- **Cons:** crossing *multiple* phase boundaries in one tick (phone locked for 5 min) requires a transition loop with careful event bookkeeping; markers (cues/countdown) still need per-tick "did we cross it?" logic bolted on; the schedule is implicit in the reducer, so tests and future consumers can't *inspect* it.
- **Verdict:** Good core idea (derived time). Adopted as the *timekeeping* primitive, but insufficient alone.

### Option C — Immutable Timeline + monotonic cursor **(recommended)**
Compile `WorkoutConfig` into an **immutable Timeline**: an ordered list of **Segments** (warmup, round, rest, …, finished) and **Markers** (countdown seconds, coaching cues) each stamped with an **absolute offset in ms from workout start**. The engine holds one number — `elapsedMs` (derived via Option B's anchor) — and a **cursor**. Each tick: compute `elapsedMs`, then emit every boundary/marker whose offset lies in `(previousElapsed, elapsedMs]`, in offset order. State (`stateAt(elapsedMs)`) is a pure lookup.
- **Pros:**
  - **Determinism:** `state` and the *set* of events for any elapsed value are pure and reproducible.
  - **Exactly-once, ordered events** fall out of monotonic crossing detection — no ad-hoc latches.
  - **Gap-safe / fast-forward:** a 5-minute lock is one tick that crosses many boundaries; the engine reconciles to the correct state and emits the crossed events in order (with a staleness policy, §5).
  - **Warmup is first-class** — just another Segment kind.
  - **Countdown/cues are cadence-independent** — markers at absolute offsets, emitted once when crossed at *any* frame rate.
  - **Inspectable:** the Timeline is data. Tests assert against it; future consumers (Watch UI, "next up" previews, AI Coach planning) read it without re-deriving logic.
- **Cons:** one more concept (Timeline) to build and understand; dynamic/adaptive workouts (AI changing durations mid-session) require *recompiling* the Timeline from the current cursor (addressed in §8 / `ENGINE.md`).
- **Verdict:** **Recommended.** It is the only option that makes execution a pure, inspectable function and cleanly supports the future-compatibility matrix.

### Option D — Adopt a state-machine library (XState)
- **Pros:** battle-tested FSM semantics, visualizer, guards/actions first-class.
- **Cons:** new runtime dependency (the repo is dependency-sensitive; see PR constraints); its "delayed transitions" are wall-clock timers — we'd still have to feed it our own `performance.now()` timekeeping to be deterministic, so we gain formalism but not the hard part; overkill for a 5-state chart.
- **Verdict:** **Rejected for the runtime**, but we adopt its *discipline* — an explicit transition table with guards and side effects (`STATE_MACHINE.md`). Revisit only if the chart grows substantially.

## 5. Recommended design (summary)

> Full specifications live in `ENGINE.md`, `STATE_MACHINE.md`, and `EVENT_MODEL.md`. This is the decision.

**Adopt Option C (Timeline + cursor) built on Option B's derived-time primitive, with Option D's transition-table discipline.**

```
            WorkoutConfig (immutable)
                   │  compile()
                   ▼
              Timeline (immutable: Segments + Markers, absolute offsets)
                   │
        ┌──────────┴───────────┐
        │   WorkoutEngine      │   owns: Clock anchor, elapsedMs, status, cursor
        │   (pure core + host) │   exposes: state snapshot  +  event stream
        └──────────┬───────────┘
                   │  EventBus (sync, ordered, isolated)
   ┌────────┬──────┼───────┬─────────┬──────────┬─────────────┐
   ▼        ▼      ▼       ▼         ▼          ▼             ▼
 Coach    Bells   UI    Stats    WakeLock   Analytics   (future: Watch,
 (→Speech)      (state)                                  HR, AI Coach)
```

Load-bearing decisions:

1. **Two channels, not one.** The engine exposes (a) a **continuous state snapshot** (`{phase, status, roundIndex, remainingMs, elapsedMs}`) for the timer display, sampled via `useSyncExternalStore`; and (b) a **discrete event stream** for coaching/bells/stats. Conflating them is what put business logic in the view today.
2. **Derived time, injected clock.** Time is computed from a `now()` provider (default `performance.now()`), never accumulated. The provider is injectable → deterministic tests.
3. **Marker delivery policy.** Segment boundaries are **always emitted** (state correctness). Real-time-only markers (countdown seconds, coaching cues) are **`drop-if-stale`**: if crossed more than a small threshold late (e.g. a background gap), they are *not* replayed — so unlocking the phone does **not** dump a burst of "five, four, three, two, one." This is the precise behaviour the "throw the phone on the floor" scenario demands.
4. **Pause is orthogonal to phase.** `status ∈ {running, paused}` crosses with `phase`, rather than a `PAUSED` state per timed phase (which would triple the transition table). Paused time is accumulated and excluded from `elapsedMs`.
5. **The engine never imports speech, audio, or React.** Coach/Bells/Wake Lock are *subscribers*. The engine has zero knowledge of them (`EVENT_MODEL.md` §Subscriber contract).
6. **Immutable session info.** The engine exposes an objective `SessionSnapshot` (elapsed, rounds completed, planned vs actual duration, status). Subjective data (rating, notes) lives in a separate History store, **not** the engine.

## 6. Consequences

**Positive**
- Every audit concern in §1 is resolved *by construction*, not by patching.
- Business logic leaves the view; the active page becomes a thin subscriber.
- New consumers are additive (new subscriber files); the engine is closed for modification, open for extension.
- The engine core is a dependency-free, framework-free, 100%-unit-testable module.

**Negative / costs**
- A migration is required (`IMPLEMENTATION_PLAN.md`): a compile step, a core reducer, a React host, and rewiring the active page + PR-001 coach seam.
- One new concept (Timeline) for contributors to learn.
- Adaptive/AI workouts require an explicit **recompile-from-cursor** operation (designed, not free).

**Neutral**
- `WorkoutPhase.ROUND_ACTIVE` is renamed to `round` in the new engine namespace; a compatibility shim keeps existing types compiling during migration.

## 7. Risks

See `IMPLEMENTATION_PLAN.md` §Risks for the full register. Headline risks: background-tab timer accuracy still depends on Wake Lock for *timeliness* (correctness holds regardless); the fast-forward staleness policy needs careful tuning; migrating without regressing the working PR-001 coaching flow requires a parity test suite first.

## 8. Decision

Proceed with **Option C** as specified across the four companion documents. Implementation is deferred to the follow-up PRs enumerated in `IMPLEMENTATION_PLAN.md`. No code changes land in this PR.

---

## 9. Amendments (per ARB decision, 2026-07-12)

The board accepted ADR-0001 as the baseline and **deferred** ADR-0002, with three required additions. These are binding on the engine build (PR-003/PR-004). They are deliberately the *cheap, non-adaptive* subset of the review's findings — none introduces the input-log / event-sourced core.

### A1 — First-class `WorkoutSession` (supersedes the bare `SessionSnapshot`)

`SessionSnapshot` (ENGINE.md §7) is promoted from a completion-only object to a **first-class session entity** with identity and lifecycle, owned by a `SessionStore` (a `StatsSubscriber` + repository; the engine stays pure and time-authoritative).

```ts
interface WorkoutSession {
  schemaVersion: number;                 // see A2
  sessionId: string;                     // stable id (crypto.randomUUID), minted at START
  workoutId: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'abandoned';
  startedAtWall: number;                 // Date.now() captured by host at START
  endedAtWall: number | null;
  monotonicAnchorMs: number;             // engine clock at START (for skew-free durations)
  plannedRounds: number;
  roundsCompleted: number;
  plannedDurationMs: number;
  activeDurationMs: number;              // excludes paused
  pausedDurationMs: number;
  cursorMs: number;                      // elapsed at last checkpoint (enables resume)
  rating: number | null;                 // subjective — appended post-workout
  notes: string | null;
}
```

Responsibilities this unlocks (closing review **M4**, cheaply, without event sourcing):
- **Durable checkpointing:** the `SessionStore` writes the session to localStorage on every lifecycle event. A closed tab / crash therefore leaves a non-terminal session on disk.
- **Recovery & resume:** on relaunch, a non-terminal session is reconciled to `abandoned` **or** offered as **Resume** by seeking the engine to `cursorMs`.
- **Correct finish stats (audit P0-2):** `/finish` reads the persisted `WorkoutSession`, not query-string guesses; rating/notes are appended to the same record and flow into History.
- **Clock hygiene:** durations derive from `monotonicAnchorMs`; only `startedAtWall`/`endedAtWall` are wall-clock (addresses review **S7**).

### A2 — Schema versioning for all persisted / transported models

Every persisted or (future) transported model carries an explicit `schemaVersion` with a documented reader-migration policy (forward-compatible readers; versioned writers). Applies to: `WorkoutSession`, `WorkoutConfig`, `UserPreferences`, and any custom-workout payload. This is the review's **M3-versioning** finding, adopted **standalone** — it is nearly free now and expensive to retrofit once data is in the field or synced. Migrations live in the respective repository, not in the engine.

### A3 — Explicit (inert) extension points for future adaptive terminators

To keep the deferred ADR-0002 path open **without** building it, reserve *named seams* now — as documentation and thin type placeholders only, with **no runtime behaviour**:

- A segment's end is expressed as `end: { kind: 'duration'; ms }` today, but the field is a **discriminated union positioned to grow** a `'signal'` / `'command'` variant later (`STATE_MACHINE.md` terminators). Only `'duration'` is implemented and tested; other variants are absent, not stubbed.
- The reducer signature is `(state, input) => { state, events[] }` where `input` is `Command | Tick` today, positioned to admit `Signal | Reshape` later.
- A `SessionStore`/repository boundary already exists (A1), which is where any future durable input-log would attach.

**Guard against A3 becoming premature abstraction (per the dissent):** these are *seams*, not implementations. No `signal`/`command`/`reshape`/input-log code is written until a §Reconsideration trigger in ADR-0002 fires. The seam is a union type with one member and a naming convention — not inert machinery to maintain.

### What is explicitly NOT adopted

Per the deferral: **no** append-only canonical input log, **no** event-sourced core, **no** replay-from-seq transport, **no** `Terminator`/`Signal`/`RESHAPE` runtime. The determinism contract stays **(D1)**. `M2` (background tick source) proceeds independently as **ADR-0003** and is prioritised ahead of any adaptive work.

