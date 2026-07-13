# ADR-0002 — Adaptive vs Deterministic Execution

- **Status:** **DEFERRED** by ARB on 2026-07-12 (not rejected). See `DECISIONS.md` / `ADR-0002-DISSENT.md`.
- **Date:** 2026-07-12
- **Answers:** `ARCHITECTURE_REVIEW.md` Question 1 (the central fork); subsumes review findings **M1**, and re-frames **M3/M4** and **Alt-A**
- **Would amend (if adopted):** `ADR-0001-workout-engine.md`, and by extension `ENGINE.md`, `STATE_MACHINE.md`, `EVENT_MODEL.md`
- **Does NOT resolve:** tick source / background execution (**M2** → deferred to ADR-0003), sync transport (→ ADR-0004). Those are compatible with either outcome here and are decided separately.

---

## 0. Board decision (2026-07-12) — DEFERRED

> **Decision.** ADR-0002 is **deferred, not rejected.** The adaptive execution model is technically sound but introduces architectural complexity not required to satisfy the currently committed product roadmap. **ADR-0001 remains the baseline architecture,** amended (see `ADR-0001` §Amendments) to include a first-class `WorkoutSession`, schema versioning for persisted models, and explicit extension points for future adaptive terminators.
>
> **Reconsideration triggers.** Re-open this ADR when **any** of the following becomes true:
> 1. At least one **adaptive execution capability** (HR-gated segment, punch-count termination, AMRAP-beyond-`SKIP`, real-time AI retiming) becomes a **committed** product requirement; or
> 2. **Replay / event-sourcing** becomes necessary for a concrete feature — e.g. **cloud sync** of in-progress sessions, multi-device live sync, or **regulatory/audit** replay.
>
> Until then this document is **on the shelf, not in the build.** The design below is preserved as the intended answer for when a trigger fires; it is expected to be *better* for having waited, because it will be specified against real constraints rather than anticipated ones.

---

## 1. Context — the decision we cannot defer

ADR-0001 chose an **immutable, absolute-offset Timeline**: workout state is a pure function of `(fixed WorkoutConfig, elapsedMs)`. The Principal review (M1) showed this is only coherent while *every segment's duration is known up front*. The roadmap's headline differentiators are not:

| Roadmap feature | Segment shape it implies |
|---|---|
| Heart Rate | "rest **until HR < 120**, max 90 s" |
| Punch Counting | "round continues **until 100 punches**" |
| AMRAP / user-paced | "round **until the user taps** next" |
| AI Coach | "**shorten** this round / insert a drill **now**" |

None of these has a knowable `endMs`. So countdown markers (`endMs − 10s`) are undefined, `stateAt(elapsedMs)` stops being a pure lookup, and `recompileFrom` — a footnote in ADR-0001 — becomes load-bearing. This is the timer assumption re-entering one layer up.

**The fork:** Is Corner's engine a *deterministic executor of fixed timelines*, or an *adaptive executor of conditionally-terminated segments*? This decision shapes the core data types, so it must be made **before** the pure core is built (PR-003). Changing these types later *is* the rewrite this whole track exists to prevent.

---

## 2. Forces

Non-negotiable properties we must keep (from ADR-0001 and the product thesis):

1. **Reproducibility for tests and debugging** — we must be able to replay a session deterministically.
2. **Inspectability** — the UI needs "next up," total/remaining estimates, and progress; tests assert against a schedule.
3. **Efficiency of the common case** — today's fixed rounds must stay O(log n) lookups, not a live interpreter with per-frame branching.
4. **Engine ignorance of presentation, sensors-as-hardware, and subscribers** — the engine must not import a heart-rate SDK.

New properties the roadmap forces:

5. **Conditional termination** — a segment may end on time, on a signal (HR/punches/tap), on a command, or the **first of several** ("HR<120 **or** 90 s").
6. **Mid-session reshaping** — AI/user may change the *remaining* plan without corrupting elapsed/paused accounting or already-emitted history.

Properties 1–3 pull toward "fixed timeline." 5–6 pull toward "dynamic interpreter." The design must satisfy both, not pick a side.

---

## 3. The crux: there are two different meanings of "deterministic"

ADR-0001 conflates them. Separating them dissolves the conflict.

- **(D1) Timeline determinism** — *state is a pure function of a fixed timeline and elapsed time.* Strong, but **false the moment a boundary depends on a runtime signal.**
- **(D2) Input determinism (reducibility)** — *state is a pure fold over an ordered log of inputs* (commands + ticks + signals). `state = reduce(inputLog)`. This is **preserved under adaptivity**, because every sensor reading and AI decision enters as a *recorded input*. Given the same input log, you reproduce the session exactly.

For a purely duration-based workout, the input log is just `{START, tick, tick, …}` and (D2) **collapses back to** (D1) — we lose nothing for today's case. (D2) is the strict generalization.

**This is the key decision of this ADR: move the determinism guarantee from (D1) to (D2).** The engine stays fully deterministic, replayable, and testable — and becomes adaptive — by making the **ordered input log the source of truth**, with the timeline as a *derived, incrementally-resolved projection*. (This is exactly the event-sourced core the review floated as Alt-A; adaptivity is the forcing function that makes it the right call rather than a nice-to-have.)

---

## 4. Options considered

### Option 1 — Stay fixed (ADR-0001 unchanged); push adaptivity to authoring
Pre-compute everything; forbid runtime-terminated segments.
- **Pros:** simplest; keeps (D1); zero new concepts.
- **Cons:** HR/punch/AMRAP/AI cannot be expressed at all, or are faked by the UI reaching into the engine — reintroducing the exact hidden coupling this track removes. Guarantees a future core rewrite. **Rejected.**

### Option 2 — Fully dynamic imperative interpreter; drop the timeline
No precompiled offsets; a live loop evaluates "what now?" each tick from mutable state.
- **Pros:** maximally flexible.
- **Cons:** loses inspectability (no "next up"/estimates without simulating), loses the efficient common path, weakens (D1) *and* makes (D2) harder (imperative state is not a clean fold), and is markedly harder to test. Throws away ADR-0001's genuine strengths. **Rejected.**

### Option 3 — Hybrid: lazy timeline + Terminator union, made deterministic by an input log **(recommended)**
Keep ADR-0001's offset-based Timeline **for the resolved prefix**; represent unknown boundaries with a **Terminator union**; resolve them at runtime from **recorded inputs**; treat the **input log as canonical** (D2).
- **Pros:** fixed prefix stays O(log n), inspectable, and identical to ADR-0001 for today's workouts; conditional termination and reshaping are expressible; determinism/replay/test/recovery preserved via (D2); unifies M1/M3/M4/Alt-A into one model.
- **Cons:** one new concept (Terminator + signals), input-log volume management, and `recompile` semantics to specify. All bounded and addressed below. **Adopted.**

---

## 5. Decision & the redefined determinism contract

**Adopt Option 3.**

> **Determinism contract (replaces ADR-0001's):** *Given the same ordered `InputLog`, the engine produces byte-identical state and the same ordered event stream.* Timelines are a derived projection of the resolved prefix of that log. A fully duration-terminated workout has an input log of `{START, TICK*}` and reduces exactly to ADR-0001's timeline determinism.

The engine is now an **event-sourced reducer**: `reduce(state, input) → {state, events[]}` folded over an append-only `InputLog`. The Timeline is a cache/projection, not the source of truth.

---

## 6. Core model changes

Type sketches (illustrative, not final signatures).

### 6.1 Terminators — how a segment can end

```ts
type Terminator =
  | { kind: 'duration'; ms: number }                       // time-based (today)
  | { kind: 'signal'; predicateId: string }                // e.g. HR<120, punches>=100
  | { kind: 'command' }                                     // user "next" / AMRAP tap
  ;

interface Segment {
  kind: 'warmup' | 'round' | 'rest';
  index: number;
  roundIndex: number;
  startMs: number;                     // known once the segment starts
  end: { anyOf: Terminator[] };        // first terminator to fire ends the segment
  // endMs is DERIVED and defined ONLY when `end.anyOf` is entirely `duration`
}
```

`anyOf` gives us "rest until HR<120 **or** 90 s max" for free: a `signal` terminator plus a `duration` cap. **Countdown markers schedule off the smallest `duration` member** (the cap); a segment with no `duration` member simply has no countdown — correct behaviour, not a bug.

### 6.2 Signals — sensors without sensor coupling

The engine never imports a heart-rate SDK. It knows only **abstract signals**:

```ts
// Inbound input, produced by a SignalSource subscriber (HR band, punch detector, UI tap)
type Input =
  | { t: 'START' } | { t: 'PAUSE' } | { t: 'RESUME' } | { t: 'SKIP' } | { t: 'CANCEL' }
  | { t: 'TICK'; now: number }
  | { t: 'SIGNAL'; name: string; value: number; at: number }     // 'hr' | 'punches' | 'tap' | …
  | { t: 'RESHAPE'; from: 'cursor'; tail: SegmentSpec[] }         // AI/user reshaping (see 6.4)
  ;

// Predicates are pure functions over the latest signal snapshot, registered by config:
// predicate 'hr-recovered' := (s) => s.hr < 120
```

A `SIGNAL` input updates a small immutable `SignalSnapshot`; on each `TICK`/`SIGNAL` the engine evaluates the active segment's `signal` terminators against it. The engine depends on *"a number named `hr`"*, not on Bluetooth. Sensor hardware lives entirely in a `SignalSource` subscriber (ADR-0004 territory).

### 6.3 Lazy / incremental timeline

`compile()` resolves the **duration-terminated prefix** into absolute offsets exactly as ADR-0001 (fast path, 100 % of today's workouts). At the **first non-duration segment**, resolution stops: everything after it is `unresolved` until that segment actually ends at runtime, at which point the next segment's `startMs` is stamped and the next prefix resolves. Inspectability degrades **gracefully**: the UI shows exact remaining time for the resolved prefix and "≈" / open-ended affordances beyond it.

### 6.4 Adaptivity = appending an input, never mutating

Mid-session reshaping (AI shortens a round; user adds a round) is a `RESHAPE` **input appended to the log**, not an out-of-band mutation. It atomically replaces the **unresolved tail** from the cursor, preserving `elapsedMs`/`pausedAccumMs` and all already-emitted events, and emits `TIMELINE_RESHAPED`. Because it's a recorded input, **replay reproduces it** — determinism (D2) holds. This replaces ADR-0001/EVENT_MODEL's under-specified `recompileFrom`/`injectCue` footnote with a single, first-class, testable operation. (`injectCue` becomes an additive `RESHAPE` that only adds a cue marker.)

### 6.5 Input log as canonical (subsumes Alt-A, M3, M4)

The append-only `InputLog` is the source of truth; state and domain events are projections.
- **Replay / debugging:** `reduce(log)` reproduces any session (D2).
- **Crash/abandon recovery (M4):** persist the log incrementally; on relaunch, `reduce(persisted log)` rehydrates the exact cursor → **resume for free**; if the last input isn't terminal, mark `abandoned`.
- **Remote subscribers / sync (M3):** a transport ships log entries with monotonic `seq`; a reconnecting Watch/cloud consumer requests **replay-from-seq** — the "no replay" limitation the review flagged disappears because the log *is* the replay substrate.
- **Volume control:** raw sensor streams are **not** logged verbatim. `SignalSource` subscribers **downsample/debounce** (e.g., HR at ≤1 Hz; punches as *threshold-crossings*, not per-punch) before emitting `SIGNAL` inputs; the log records only inputs that can change a terminator outcome. Periodic **snapshot+truncate** compaction bounds growth.

---

## 7. Worked examples

1. **Today's 3×3 (fixed).** Log = `{START, TICK×N}`. Prefix fully resolves; `endMs` defined everywhere; countdowns at `endMs−{10,5,…}`. Identical to ADR-0001. *Nothing changes for the shipping product.*
2. **AMRAP round.** Round segment `end = { anyOf: [{kind:'command'}] }`. No countdown (no duration member). A `SKIP`/tap input fires it. Replay with the same tap timestamps reproduces exactly.
3. **Active recovery "rest until HR<120, max 90 s."** `end = { anyOf: [{signal:'hr-recovered'}, {duration:90_000}] }`. Countdown schedules off the 90 s cap; if HR recovers at 47 s, the `signal` terminator fires first, `REST_COMPLETED` emits at 47 s, and the cap is discarded. The recorded `SIGNAL` samples make it replayable.
4. **AI shortens round 3 to 2 min at the 30 s mark.** `RESHAPE{from:'cursor', tail:[round3(120s), …]}` is appended; the unresolved tail rebuilds; `elapsed` preserved; `TIMELINE_RESHAPED` emitted; countdown for the new end reschedules. Replaying the log (including the RESHAPE) reproduces the adapted session.

---

## 8. Consequences

**Positive**
- Resolves **M1**: adaptive/predicate/open-ended segments are first-class; the shipping fixed workout is a strict special case with zero added cost.
- Resolves **M4** and de-risks **M3**: the input log gives crash recovery, resume, replay, and replay-from-seq transport essentially for free.
- Strengthens testing: tests feed a scripted `InputLog` and assert `{state, events}`; `replay(log) === replay(log)` is a property test. FakeClock ticks are just `TICK` inputs.
- The engine stays sensor-agnostic and presentation-agnostic; hardware and content stay in subscribers/sources.

**Negative / costs**
- One new core concept (Terminators + signals + input log) contributors must learn.
- `RESHAPE` and `anyOf` firing semantics must be specified precisely and tested (edge: two terminators firing on the same tick → deterministic tie-break = declaration order).
- Inspectability is partial beyond the first unresolved segment (mitigated by "≈"/estimate affordances).
- Log volume/compaction is now an engine concern (bounded by downsampling + snapshot-truncate).

**Neutral**
- Countdown/cue markers become **boundary-relative** (`fromEnd`) and are scheduled when an end becomes known — a small change to EVENT_MODEL, already implied by the review (S6-adjacent).

**Explicitly not resolved here:** the **tick/background source (M2)** — but note (D2) *helps* it: ticks and signals can originate from a Web Worker or audio clock without the core caring, so ADR-0003 is unblocked and independent.

---

## 9. Guarding against over-engineering — phased adoption

Decide the **model** now; implement **incrementally**. This is the discipline that keeps this from becoming speculative generality:

- **PR-003 (core):** implement types for `Terminator`/`Input`/`InputLog` and the reducer, but the **only runtime-active terminator is `duration`** and the only inputs are `START/PAUSE/RESUME/SKIP/CANCEL/TICK`. `signal`/`command`/`RESHAPE` are **typed but inert** extension points with tests asserting they're wired but unused. Ships behaviourally identical to a fixed-timeline engine.
- **Later feature PRs** activate `command` (AMRAP), `signal` (HR/punches, with a `SignalSource`), and `RESHAPE` (AI) **without changing core types** — which is the entire point.

Net: we pay a small upfront modelling cost (a union type and an input log) to buy out the M1 rewrite risk, and we do **not** build sensor/AI machinery until those features are real.

---

## 10. Required amendments to existing docs (if approved)

| Doc | Change |
|---|---|
| `ADR-0001` | Add "Superseded in part by ADR-0002"; replace the (D1) determinism statement with the (D2) contract; downgrade the fixed-Timeline claim to "the resolved-prefix projection." |
| `ENGINE.md` | Segment gains `end: {anyOf: Terminator[]}`; `endMs` becomes derived/partial; add `SignalSnapshot`, predicates, `InputLog`, `RESHAPE`; timeline described as incremental. |
| `STATE_MACHINE.md` | Add `SIGNAL` and `RESHAPE` as inputs; boundary transitions fire on "terminator satisfied" (time **or** signal **or** command), not only `TICK`-crossing; add same-tick tie-break rule. |
| `EVENT_MODEL.md` | Add `SIGNAL_RECEIVED?`, `TIMELINE_RESHAPED`; markers become boundary-relative; note the input log underpins replay/transport (revisit "no replay" stance). |
| `IMPLEMENTATION_PLAN.md` | PR-003 scope note: types-now / duration-only-runtime; add `replay(log)===replay(log)` and reshape/anyOf tests. |

---

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| A | Input-log volume from sensors | Downsample/debounce in `SignalSource`; log only outcome-changing inputs; snapshot-truncate compaction |
| B | `RESHAPE`/`anyOf` semantics get subtle (ties, reshape during pause) | Specify firing order + tie-break (declaration order); tests for reshape-while-paused, reshape-past-cursor rejection |
| C | Partial inspectability confuses UI/estimates | Explicit "resolved vs estimated" flags in the snapshot; UI affordances for open-ended segments |
| D | Team over-builds sensor/AI early | §9 phasing: types inert until a real feature; review gate |
| E | (D2) replay drifts if any impurity leaks into the reducer | Enforce pure reducer (no `Date.now`/`Math.random`/IO); lint/test guard; all nondeterminism enters as inputs |

---

## 12. Decision

Adopt **Option 3**: a hybrid lazy-timeline engine with a **Terminator union** and **signals**, made deterministic by an **append-only input log** (D2), implemented **duration-only first** (§9). This answers `ARCHITECTURE_REVIEW.md` Q1 in favour of **adaptive execution with input-determinism**, preserves everything ADR-0001 got right for the shipping product, and removes the M1 rewrite risk while unifying M3/M4/Alt-A. Follow-on decisions — **ADR-0003 (tick source / background execution, M2)** and **ADR-0004 (sync & transport, M3 delivery)** — are unblocked and can proceed independently.
