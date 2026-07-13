# EVENT_MODEL.md — Workout Engine Event Model

Companion to `ADR-0001` and `STATE_MACHINE.md`. Defines the two consumer channels, the event catalogue with payloads, ordering, idempotency, delivery guarantees, and the subscriber contract.

---

## 1. Two channels

Consumers need two fundamentally different things. Conflating them is the root of today's "business logic in the view" problem.

| Channel | Shape | Cadence | Consumers | Mechanism |
|---|---|---|---|---|
| **State** | Continuous snapshot | Sampled (≈ per animation frame, coalesced to 1 Hz for text) | Timer display, progress ring, "round X of Y" | Pull via `useSyncExternalStore(subscribe, getSnapshot)` |
| **Events** | Discrete, ordered messages | Only when something happens | Coach → Speech, Bells, Stats, Wake Lock, Analytics, Watch, AI | Push via `EventBus.subscribe(handler)` |

**State snapshot** (immutable, cheap to produce):

```ts
interface WorkoutSnapshot {
  phase: 'idle' | 'warmup' | 'round' | 'rest' | 'finished';
  status: 'running' | 'paused';
  roundIndex: number;        // -1 outside rounds
  roundNumber: number;       // 1-based, 0 outside rounds
  totalRounds: number;
  remainingMs: number;       // in the current segment
  remainingSeconds: number;  // ceil(remainingMs/1000) — for display
  elapsedMs: number;         // whole-session elapsed (excludes paused)
  phaseDurationMs: number;
  progress: number;          // 0..1 within the current segment
}
```

The UI **reads** this; it never derives coaching from it. Coaching comes from the event channel.

---

## 2. Event catalogue

All events share an envelope; `data` is event-specific.

```ts
interface WorkoutEvent<T = unknown> {
  type: WorkoutEventType;
  at: number;          // engine clock (ms, monotonic) when emitted
  elapsedMs: number;   // session elapsed at emission
  seq: number;         // monotonically increasing per session (dedupe/ordering key)
  data: T;
}
```

| Type | `data` payload | Emitted when | Delivery policy |
|---|---|---|---|
| `WORKOUT_STARTED` | `{ workoutId, totalRounds, plannedDurationMs, hasWarmup }` | `START` from `idle` | always |
| `WARMUP_STARTED` | `{ durationMs }` | Entering `warmup` | always |
| `WARMUP_COMPLETED` | `{}` | Leaving `warmup` | always |
| `ROUND_STARTED` | `{ roundIndex, roundNumber, round, durationMs }` | Entering a `round` | always |
| `ROUND_COMPLETED` | `{ roundIndex, roundNumber }` | Leaving a `round` | always |
| `REST_STARTED` | `{ durationMs, nextRoundIndex, nextRound }` | Entering `rest` | always |
| `REST_COMPLETED` | `{ restIndex }` | Leaving `rest` | always |
| `COUNTDOWN_STARTED` | `{ context: 'round'\|'rest', fromSeconds }` | Crossing the first countdown marker (e.g. 10 s left) | **drop-if-stale** |
| `COUNTDOWN_SECOND` | `{ context, secondsRemaining }` | Crossing each countdown marker (10,5,4,3,2,1) | **drop-if-stale** |
| `COACH_CUE` | `{ roundIndex, cueId, text, atMs }` | Crossing a coaching-cue marker | **drop-if-stale** |
| `WORKOUT_PAUSED` | `{ phase, elapsedMs }` | `PAUSE` | always |
| `WORKOUT_RESUMED` | `{ phase, elapsedMs, pausedForMs }` | `RESUME` | always |
| `WORKOUT_COMPLETED` | `SessionSnapshot` (see `ENGINE.md`) | Crossing final boundary | always |
| `WORKOUT_CANCELLED` | `{ elapsedMs, roundsCompleted }` | `CANCEL` | always |

### Delivery policy semantics
- **`always`** — lifecycle/state-correctness events. Emitted even during fast-forward reconciliation, in order.
- **`drop-if-stale`** — real-time-only markers. Emitted **only** if crossed within `STALE_THRESHOLD_MS` (proposed default **1500 ms**) of "now". After a background gap, stale countdown/cue markers are **skipped**, so unlocking the phone does not replay "five, four, three, two, one." (See `STATE_MACHINE.md` §5.)

---

## 3. Ordering guarantees

1. **Global order = `seq` order.** Every event carries a session-monotonic `seq`. Subscribers may assume strictly increasing `seq`.
2. **Canonical intra-tick order.** When one `TICK` produces several events, they are emitted in this precedence:
   `*_COMPLETED` (leaving) → `*_STARTED` (entering) → markers within the new segment.
   Concretely, a round→rest boundary emits `ROUND_COMPLETED` **then** `REST_STARTED`. A final round emits `ROUND_COMPLETED` **then** `WORKOUT_COMPLETED`.
3. **Multi-boundary order.** During fast-forward, boundaries are emitted in increasing offset order (chronological), never interleaved.
4. **Commands are synchronous.** `WORKOUT_PAUSED`/`RESUMED`/`CANCELLED` are emitted inline during the command call, before it returns.

---

## 4. Idempotency & delivery guarantees

- **Exactly-once per logical occurrence.** Guaranteed by the monotonic cursor (`STATE_MACHINE.md` §5): a boundary/marker is emitted only when the cursor first crosses it. Re-ticking the same clock value emits nothing.
- **Synchronous, in-process delivery.** The `EventBus` invokes subscribers synchronously in subscription order within the emitting call. No microtask/async gaps → deterministic tests, no races.
- **Subscriber isolation.** Each subscriber invocation is wrapped in `try/catch`. A throwing subscriber is logged and skipped; it cannot break the engine or other subscribers. (Directly supports the "subscriber isolation" test.)
- **No replay for late subscribers.** Discrete events are not buffered/replayed on subscribe. A late subscriber gets the **current state snapshot** (via the state channel) to initialise, then live events onward. Rationale: replaying "round 1 started" to a subscriber that attached in round 3 is almost always wrong; consumers that need history read the `SessionSnapshot`/event log from the Stats subscriber.
- **At-least-once is *not* offered and *not* needed** — in-process synchronous delivery makes exactly-once the natural guarantee.

---

## 5. Subscriber contract

```ts
type Unsubscribe = () => void;
interface WorkoutEventBus {
  subscribe(handler: (e: WorkoutEvent) => void): Unsubscribe;
}
```

Rules every subscriber MUST follow (enforced by review + tests):

1. **Read-only.** A subscriber MUST NOT call engine commands in a way that mutates workout progression as a *reaction to an event* (no feedback loops). Commands come from user intent (UI), not from other subscribers. (Exception: an explicit, documented *inbound command channel* for adaptive coaching — §7.)
2. **No cross-subscriber knowledge.** The Coach does not know Bells exist; Stats does not know the UI exists. The only shared contract is the event envelope.
3. **Pure/side-effect-local.** A subscriber's effects are its own domain (speak, ring, persist, render). It must tolerate `drop-if-stale` gaps (e.g., the coach must handle "round 3 started" without having heard rounds 1–2 during a fast-forward).
4. **Idempotent handlers preferred.** Even with exactly-once delivery, handlers should be defensive (PR-001's `CoachEngine` already is — it stays valuable as a second line of defence).

### Standard subscribers (initial set)

| Subscriber | Consumes | Effect |
|---|---|---|
| **CoachSubscriber** | `ROUND_STARTED`, `COACH_CUE`, `COUNTDOWN_SECOND`, `REST_STARTED`, `WARMUP_STARTED`, `WORKOUT_STARTED/COMPLETED` | Calls PR-001 `CoachEngine.*` → `SpeechService` |
| **BellSubscriber** | `ROUND_STARTED`, `REST_STARTED`, `WORKOUT_COMPLETED`, `COUNTDOWN_SECOND(1)` | `lib/audio` bells |
| **StatsSubscriber** | all | Accumulates `SessionSnapshot`; persists on completion |
| **WakeLockSubscriber** | `WORKOUT_STARTED/PAUSED/RESUMED/COMPLETED/CANCELLED` | Acquire/release screen wake lock (design only, PR-005) |
| **AnalyticsSubscriber** | selected lifecycle events | Fire-and-forget metrics |

---

## 6. How this maps onto PR-001

PR-001's `CoachEngine` and `SpeechService` are **unchanged in contract**. The `CoachSubscriber` is a thin translation from events to the existing `CoachEngine` methods:

```
ROUND_STARTED   → coach.announceRound(round, roundNumber)
COACH_CUE       → coach.<speak cue>          (cue text already resolved in the event)
COUNTDOWN_SECOND→ coach.<speak second>
REST_STARTED    → coach.announceRest(finishingRound, nextRound.name)
WORKOUT_STARTED → coach.announceWorkoutStart(workout); coach.announceWarmup() (if hasWarmup)
WORKOUT_COMPLETED→ coach.announceComplete(totalRounds)
```

The engine gains **first-class warmup and cue/countdown markers**, so the active page stops polling `timeRemaining` and deriving cues itself. The view becomes: render `WorkoutSnapshot`, forward user intent as commands. **The Workout Engine never imports Speech, Audio, or React** — the separation the prompt requires is structural, not conventional.

---

## 7. Inbound command channel (future — AI Coach)

Adaptive coaching (AI shortening a round, injecting a dynamic cue) needs to *influence* the session. To preserve determinism we constrain this to two explicit, audited operations, never ad-hoc mutation:

- **`injectCue(text, atMsFromNow)`** — additive speech only; does not change state or timeline. Safe.
- **`recompileFrom(cursor, newConfigTail)`** — atomically rebuilds the Timeline for the *remaining* session from the current cursor, preserving elapsed/paused accounting and emitting a `TIMELINE_RECOMPILED` event. This is the *only* sanctioned way to mutate structure mid-session, and it keeps `stateAt()` pure afterward.

Both live behind an explicit `EngineCommandPort`, separate from the read-only `EventBus`, so "subscribers never modify engine state" remains true for everyone except the one intentional, reviewed adaptive-coaching seam.
