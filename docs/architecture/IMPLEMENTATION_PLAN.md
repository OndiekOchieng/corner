# IMPLEMENTATION_PLAN.md — Workout Engine Migration

Companion to `ADR-0001`, `ENGINE.md`, `STATE_MACHINE.md`, `EVENT_MODEL.md`. Sequences the build, defines the testing strategy, enumerates risks, and breaks the work into follow-up PRs. **No code lands in this (design) PR.**

---

## 1. Guiding constraints for the migration

1. **Never regress the working PR-001 coaching flow.** A parity test suite is written *first*, against current observable behaviour, and must stay green through the swap.
2. **Strangler pattern.** Build `lib/engine/*` alongside the current hook; cut the active route over behind an internal boundary; delete the old engine only once parity holds.
3. **Framework-free core lands before any React rewiring.** The pure modules (`config`, `timeline`, `reducer`, `bus`, `session`) are fully tested in isolation before the host adapter exists.
4. **One concern per PR.** Small, reviewable, independently revertible.

---

## 2. Build sequence (within the follow-up PRs of §6)

```
config.ts + timeline.ts        → pure, tested first (the deterministic heart)
clock.ts (real + fake)         → injectable time
reducer.ts                     → FSM per STATE_MACHINE.md; tested with FakeClock
bus.ts + session.ts            → event delivery + stats accumulation
engine.ts                      → assembles core + host loop + API (ENGINE.md §5)
hooks/useWorkoutEngine.ts      → React host (useSyncExternalStore + subscribe)
subscribers/coach|bell|stats   → thin translators (CoachSubscriber reuses PR-001)
active route rewire            → view becomes a subscriber; delete polling logic
delete legacy useRAFTimer/old engine
```

---

## 3. Testing strategy

The core is deterministic and framework-free, so tests are **fast, hermetic, and exhaustive**. Reuse the PR-001 stack (Vitest + `MockSpeechSynthesis`) and add a `FakeClock`.

### 3.1 Test doubles
- **`FakeClock`** — `now()` returns a controllable value; `advance(ms)` steps it. No real timers, no `Date.now`.
- **Driver helper** — `run(engine, clock).advanceBy(ms, stepMs?)` steps the clock and calls `tick()` at a chosen granularity to simulate frame cadence (fine steps = 60 fps; one big step = background gap).
- **Recording subscriber** — captures `(seq, type, data)` for order/idempotency assertions.

### 3.2 Coverage matrix

| Area | Representative tests |
|---|---|
| **Timeline (pure)** | segment offsets contiguous; warmup present iff `warmupMs>0`; no trailing rest after final round; per-round durations honoured; countdown/cue marker offsets correct |
| **Fake clock / state transitions** | idle→warmup→round→rest→…→finished in order; `stateAt` matches expected phase at boundary ±1 ms |
| **Phase completion determinism** | fine-grained ticks vs single coarse tick over the same interval yield the **same** events (proves cadence-independence) |
| **Pause** | paused time excluded from `elapsedMs`; `WORKOUT_PAUSED` emitted once; no time-driven transitions while paused |
| **Resume** | `pausedForMs` correct; progression continues from frozen elapsed; `pause conservation` invariant holds |
| **Cancel** | `WORKOUT_CANCELLED` with correct `roundsCompleted`; returns to idle; subsequent `start()` works |
| **Background behaviour (fast-forward)** | lock for N minutes → single tick → lands in correct state; `always` events emitted in order; `drop-if-stale` countdown/cues **suppressed** (no replay burst) |
| **Event ordering** | `*_COMPLETED` before `*_STARTED`; `ROUND_COMPLETED(last)` before `WORKOUT_COMPLETED`; `seq` strictly increasing |
| **Idempotency** | re-`tick` same `now` emits nothing; `ROUND_STARTED(i)` / `WORKOUT_COMPLETED` at most once |
| **Subscriber isolation** | a subscriber that throws is caught; other subscribers still receive the event; engine state unaffected |
| **Determinism invariants** | property-style: for random tick sequences, round-start count == `roundCount`, monotonic, no dupes (`STATE_MACHINE.md` §8) |
| **Session/stats** | `SessionSnapshot` durations reconcile: `active + paused == elapsedWall`; `roundsCompleted` correct on complete vs cancel |
| **Coach parity (integration)** | driving the new engine through a full workout produces the **same** `CoachEngine` call sequence the PR-001 suite expects |

### 3.3 What we deliberately do **not** test with real timers
No `setTimeout`, no real `requestAnimationFrame`, no real voices, no jsdom for the core. Real-timer behaviour is a thin host concern verified once via a lightweight integration check, not the unit suite.

---

## 4. Migration & rollout

1. **Parity harness (PR-002a).** Encode current active-route behaviour (round/cue/countdown/rest/finish sequence) as a black-box expectation using the PR-001 mock. This is the safety net.
2. **Land the pure core (PR-003).** No app wiring; pure tests only. Zero user-visible change.
3. **Assemble engine + host (PR-004).** New `useWorkoutEngine`; keep the old file until cutover.
4. **Cutover the active route (PR-004).** Swap the route to the new host + subscribers behind one import change; parity harness must stay green. Delete `useRAFTimer` and the legacy engine in the same PR once green.
5. **Finish statistics (PR-004/PR-006).** Wire `SessionSnapshot` → `/finish` and History store; retire the query-string handoff.
6. **Wake lock (PR-005).** Add `WakeLockSubscriber`; progressive enhancement, no correctness dependency.

Rollout is low-risk: the deterministic core can be validated to exhaustion offline before it touches the UI, and the strangler cut is a single seam.

---

## 5. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Background tabs still can't play audio on time (OS-suspended CPU) | High | Med | Documented as timeliness-not-correctness; Wake Lock (PR-005) keeps screen awake for the core use case; correctness proven independent of it |
| R2 | `drop-if-stale` threshold mis-tuned → either replay bursts or dropped legitimate cues | Med | Med | Single tunable `STALE_THRESHOLD_MS` (default 1500 ms); unit tests pin the boundary behaviour both sides |
| R3 | Migration regresses PR-001 coaching | Med | High | Parity harness written first (§4.1); cutover gated on it |
| R4 | `performance.now()` anomalies / clock regressions | Low | Med | Monotonic guard G4; clamped elapsed; FakeClock tests for regression |
| R5 | Adaptive AI `recompileFrom` reintroduces non-determinism | Low (future) | High | Confined to one audited port; recompiled timeline is still pure; `TIMELINE_RECOMPILED` event + tests |
| R6 | Scope creep (engine PR pulls in builder/history/wearables) | Med | Med | Strict non-goals in ADR; future features are *proven admissible*, not built here |
| R7 | Two engines coexist during migration causing drift | Low | Med | Time-boxed strangler; legacy deleted in the cutover PR, not "later" |
| R8 | `useSyncExternalStore` snapshot churn causes excess re-render | Low | Low | Coalesce text to 1 Hz; memoize snapshot; separate progress-ring subscription if needed |

---

## 6. Follow-up PR breakdown

This design PR (PR-002) ships **only** these five documents. Implementation is sequenced as:

| PR | Title | Scope | Depends on |
|---|---|---|---|
| **PR-002a** | Engine parity harness | Black-box tests capturing current coaching behaviour via PR-001 mock | — |
| **PR-003** | Pure engine core | `config`, `timeline`, `clock`, `reducer`, `bus`, `session` + exhaustive unit tests. No app wiring. | PR-002a |
| **PR-004** | Engine host + cutover | `engine.ts`, new `useWorkoutEngine`, Coach/Bell/Stats subscribers, rewire active route, delete `useRAFTimer` + legacy engine, wire `SessionSnapshot` → `/finish` | PR-003 |
| **PR-005** | Wake Lock | `WakeLockSubscriber`, visibility re-acquire, progressive enhancement | PR-004 |
| **PR-006** | Session persistence & History | History store, ratings/notes, real History page | PR-004 |
| **PR-007** | First-class warmup UX | Warmup screen/label consuming `WARMUP_STARTED` (removes PR-001 announcement stopgap) | PR-004 |

Later, feature-track PRs (Coach Packs, Builder, Custom Workouts, Cloud Sync, Watch, HR, AI Coach) attach as **new authoring sources or subscribers** per `ENGINE.md` §8 — none reopens `lib/engine/*`.

---

## 7. Definition of done for the engine track (PR-003 + PR-004)

- Pure core is dependency-free, framework-free, and passes the full §3 matrix.
- The active route contains **no** workout business logic — only snapshot rendering + command dispatch.
- `useRAFTimer` and the legacy `useWorkoutEngine` internals are deleted.
- All audit concerns from `ADR-0001` §1 are closed and covered by tests.
- PR-001 coaching behaviour is unchanged (parity harness green).
- `tsc` clean for all engine files; no `ignoreBuildErrors` reliance for the new code.
