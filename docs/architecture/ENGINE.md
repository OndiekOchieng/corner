# ENGINE.md — Workout Engine Specification

Companion to `ADR-0001`, `STATE_MACHINE.md`, `EVENT_MODEL.md`. Specifies the engine's responsibilities, module boundaries, public API, the Timeline model, timekeeping, session/statistics, and the wake-lock seam. Specification only — no implementation in this PR.

---

## 1. Responsibilities (and non-responsibilities)

**The engine owns:**
- **Time** — a single injected clock; derived `elapsedMs`; pause accounting.
- **State** — the FSM context (`STATE_MACHINE.md` §1).
- **Transitions** — the only code that changes phase/status.
- **Events** — emits the discrete event stream and publishes the state snapshot.
- **Immutable session facts** — objective statistics.

**The engine does NOT own / know about:**
- Speech, audio, wake lock, analytics, wearables (all subscribers).
- React (a thin host adapter bridges to hooks; the core is framework-free).
- Persistence, ratings, notes (History store).
- How a workout was authored (seed, custom, Coach Pack, AI) — it only consumes a `WorkoutConfig`.

This boundary is the whole point: **consumers subscribe; they never reach in.**

---

## 2. Module layout

```
lib/engine/
  config.ts        WorkoutConfig type + normalize(seedWorkout | customWorkout) → WorkoutConfig
  timeline.ts      compile(WorkoutConfig) → Timeline   (pure; Segments + Markers)
  clock.ts         Clock interface + realClock (performance.now) + FakeClock (tests)
  reducer.ts       pure (state, input) → { state, events[] }   — the FSM core
  engine.ts        WorkoutEngine class: owns clock+state, runs the rAF host loop,
                   exposes commands, EventBus, and getSnapshot()/getSession()
  bus.ts           EventBus (sync, ordered, isolated)
  session.ts       SessionSnapshot type + accumulation from events
  index.ts         public surface

hooks/
  useWorkoutEngine.ts   React host adapter (replaces current implementation):
                        useSyncExternalStore(snapshot) + subscribe(events) + commands

subscribers/            (thin, one concern each)
  coachSubscriber.ts    events → PR-001 CoachEngine
  bellSubscriber.ts     events → lib/audio
  wakeLockSubscriber.ts events → Screen Wake Lock  (PR-005)
  statsSubscriber.ts    events → SessionSnapshot / History store
```

`lib/engine/*` is **dependency-free and framework-free** (no React, no DOM beyond the injected clock). That is what makes it unit-testable and portable to a Web Worker or a wearable companion later.

---

## 3. The Timeline model

`compile()` turns an immutable `WorkoutConfig` into an immutable `Timeline`. This is the heart of the deterministic design.

```ts
type SegmentKind = 'warmup' | 'round' | 'rest';

interface Segment {
  kind: SegmentKind;
  index: number;        // segment ordinal
  roundIndex: number;   // for round/rest; -1 for warmup
  startMs: number;      // absolute offset from workout start
  endMs: number;
}

type MarkerKind = 'countdown' | 'cue';
interface Marker {
  kind: MarkerKind;
  atMs: number;                 // absolute offset from workout start
  segmentIndex: number;
  delivery: 'always' | 'drop-if-stale';   // markers are always 'drop-if-stale'
  payload:
    | { kind: 'countdown'; context: 'round' | 'rest'; secondsRemaining: number }
    | { kind: 'cue'; roundIndex: number; cueId: string; text: string };
}

interface Timeline {
  segments: Segment[];   // contiguous: segments[n].endMs === segments[n+1].startMs
  markers: Marker[];     // sorted by atMs
  totalMs: number;       // === last segment.endMs
  roundCount: number;
  hasWarmup: boolean;
}
```

**Construction rules**
- A `warmup` segment is emitted iff `config.warmupMs > 0` (first-class, fixes the PR-001 stopgap).
- For each round `i`: a `round` segment of `config.rounds[i].workMs`; then a `rest` segment of `config.rounds[i].restMs` **iff `i` is not the last round** (removes the trailing-rest edge case; `STATE_MACHINE.md` G6).
- Per-round durations come from `config.rounds[i]` — honouring per-round times (fixes audit P1-1), unlike today's workout-level `roundDuration`.
- Countdown markers per timed segment at `endMs − {10,5,4,3,2,1}s` (only those ≥ `startMs`), `context` = segment kind.
- Cue markers at `roundSegment.startMs + cue.timeSeconds*1000` for each coaching cue, text pre-resolved so subscribers carry no lookup logic.

**Purity payoff:** `stateAt(elapsedMs)` and "markers in `(a,b]`" are pure lookups over sorted arrays (binary search). The engine's per-tick work is O(log n + crossed). Tests assert directly against a compiled `Timeline` with zero mocking.

---

## 4. Timekeeping

```ts
interface Clock { now(): number; }          // realClock → performance.now()
```

- **Anchor on START:** `startedAt = clock.now()`.
- **Derive, never accumulate:** `elapsedMs = clamp(now − startedAt − pausedAccumMs, 0, totalMs)` while running.
- **Pause:** record `pausedAt = now`; on resume `pausedAccumMs += now − pausedAt`. `elapsedMs` is frozen while paused.
- **Monotonic guard (G4):** never let `now` regress.
- **Host loop:** a `requestAnimationFrame` loop calls `engine.tick(clock.now())` each frame **only while running**; paused/idle/finished cancel the loop. rAF drives *sampling*, not *truth* — truth is `elapsedMs`. A dropped/slow frame changes nothing; the next tick computes the correct elapsed.
- **Visibility resync:** a `visibilitychange → visible` handler calls `engine.tick(clock.now())` immediately, triggering fast-forward reconciliation (`STATE_MACHINE.md` §5) so a returning tab lands in the correct state at once.

### Browser behaviour matrix (why this design)

| Scenario | rAF behaviour | Naïve counter (today) | Timeline + derived time |
|---|---|---|---|
| Foreground, 60 fps | ~16 ms ticks | OK | OK |
| Foreground, jank | irregular ticks | drift accumulates | exact (derived) |
| Background tab | throttled to ~1/s or paused | freezes / drifts | correct on next tick; boundaries fast-forwarded |
| Device sleep / phone lock | rAF suspended | frozen | correct on wake; stale markers dropped |
| Return to foreground | resumes | shows stale time | resyncs immediately via visibility handler |

**Trade-off, stated plainly:** while backgrounded, event *timeliness* is lost (the coach can't speak "round 2" out loud at the exact second if the CPU is asleep). Correctness is preserved (state + completion are right on wake). **Wake Lock** (§6) is the mitigation that keeps the screen awake so audio stays timely for the "phone on the floor" use case. Design keeps the two concerns independent: correctness = engine; timeliness = wake lock.

---

## 5. Public API

```ts
class WorkoutEngine {
  constructor(config: WorkoutConfig, opts?: { clock?: Clock });

  // Commands (from UI / user intent only)
  start(): void;
  pause(): void;
  resume(): void;
  skip(): void;             // advance to next segment (SKIP)
  cancel(): void;
  restart(): void;          // START from finished

  // Time (from host loop / visibility handler)
  tick(now: number): void;

  // Read channels
  getSnapshot(): WorkoutSnapshot;                 // for useSyncExternalStore
  subscribeState(cb: () => void): Unsubscribe;    // notified when snapshot changes
  events: WorkoutEventBus;                         // subscribe(handler) → Unsubscribe

  // Immutable facts
  getSession(): SessionSnapshot;
  getTimeline(): Timeline;                         // inspectable (UI previews, tests, AI)

  dispose(): void;                                 // cancel loop, release subscribers
}
```

Consumers use **exactly** three things: `getSnapshot()`/`subscribeState` (display), `events.subscribe` (coaching/bells/stats), and the command methods (user intent). Nothing else can influence execution.

### React host (`useWorkoutEngine`)
Replaces the current hook. Responsibilities: instantiate the engine from a `WorkoutConfig`, run the rAF + visibility loop, expose `snapshot` via `useSyncExternalStore`, and return typed command callbacks. It attaches the standard subscribers (Coach, Bells, Stats) — or, better, subscribers are attached at the route so the hook stays generic. It holds **no** business logic.

---

## 6. Wake lock seam (design only — do not implement)

- **API:** `navigator.wakeLock.request('screen')` → a `WakeLockSentinel`; `sentinel.release()`.
- **Support (as of 2026):** Chromium (desktop/Android) and Safari 16.4+ support it; older iOS Safari and some Firefox builds do not. Treat as progressive enhancement.
- **Lifecycle:** the OS **auto-releases** the sentinel when the tab is hidden. Therefore re-acquire on `visibilitychange → visible` while a workout is running.
- **Fallback:** none that's clean without a dependency (the classic silent-`<video>` "NoSleep" hack is fragile and adds weight). **Recommended fallback = the engine's own correctness guarantee**: even if the screen sleeps, on wake the session reconciles to the right state. So wake lock is a *timeliness* enhancement, not a *correctness* dependency.
- **Placement:** a `WakeLockSubscriber` reacting to lifecycle events. The engine has **zero** knowledge of it. Ship in **PR-005**.

---

## 7. Statistics & session ownership

> **Amended by ARB 2026-07-12 (`ADR-0001` §9.A1):** the `SessionSnapshot` below is promoted to a first-class **`WorkoutSession`** entity (session id + lifecycle + `schemaVersion` + durable checkpointing for crash-recovery/resume), owned by a `SessionStore`. The engine still produces the *objective* fields; identity, persistence, and subjective rating/notes belong to the store. Treat the type below as the objective core of `WorkoutSession`.

The engine exposes **objective, immutable** facts; subjective data lives elsewhere.

```ts
interface SessionSnapshot {
  workoutId: string;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  startedAt: number;              // wall-clock (Date.now) captured at START by host
  endedAt: number | null;
  plannedRounds: number;
  roundsCompleted: number;
  plannedDurationMs: number;      // timeline.totalMs
  activeDurationMs: number;       // elapsed excluding paused
  pausedDurationMs: number;
  elapsedWallMs: number;          // active + paused
}
```

| Datum | Owner | Rationale |
|---|---|---|
| elapsed / rounds completed / durations | **Engine** (`SessionSnapshot`) | Pure function of timeline + elapsed. |
| session start/end wall-clock | Host adapter (stamps `Date.now()` at START/END; engine uses monotonic clock internally) | Engine must stay on a monotonic clock; wall-clock is presentation. |
| rating / notes | **History store** (post-workout) | Subjective; captured on the finish screen, not during execution. |
| history list / streaks | **History store** (persists `SessionSnapshot` + rating/notes) | Cross-session concern, not execution. |

This resolves audit P0-2: the finish screen reads the persisted `SessionSnapshot` (real duration/rounds), not query-string guesses; ratings/notes are appended by the History store.

---

## 8. Future compatibility (how the engine stays closed for modification)

Every future capability is either a new **input source** (compiles to a `WorkoutConfig`/`Timeline`) or a new **subscriber** (consumes events). None changes `lib/engine/*`.

| Future feature | Mechanism | Engine change? |
|---|---|---|
| Coach Packs, Custom Workouts, Workout Builder | Author → `WorkoutConfig` → `compile()` | none |
| Cloud Sync | Repository behind config load + `StatsSubscriber` persistence | none |
| Apple Watch / Wear OS | Companion subscriber mirroring snapshot+events over a transport; the framework-free core can run on-device | none |
| Heart Rate / Punch Counting | **Inbound sensor streams** merged by `StatsSubscriber`; engine stays time-authoritative, sensors are parallel data | none |
| AI Coach | Event subscriber for cues + the audited `EngineCommandPort` (`injectCue`, `recompileFrom`) for adaptation | none to core FSM; uses the designed seam |
| Workout Sharing | Serialize/deserialize `WorkoutConfig` | none |

The invariant: **the Workout Engine is a pure, inspectable time+state authority.** Authoring feeds it; subscribers observe it; one audited port allows adaptive structure changes. That is the foundation that avoids the next rewrite.
