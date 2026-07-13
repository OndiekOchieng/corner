# Architecture — Snapshot

The canonical, high-level view of Corner as it is built today. For the narrative
tour see the root [`ARCHITECTURE.md`](../ARCHITECTURE.md); for the deep design see
[`docs/architecture/`](architecture/), [`docs/coaching-runtime/`](coaching-runtime/),
and [`docs/media-runtime/`](media-runtime/). For the engineering principles behind
these boundaries, see [`ARCHITECTURE_PRINCIPLES.md`](ARCHITECTURE_PRINCIPLES.md).

---

## The canonical diagram

```
                    Workout  (immutable content: rounds, cues, timing)
                       │  compiled to a WorkoutConfig
                       ▼
              Execution Engine   pure domain — Timeline + state machine +
                       │         reducer (state, command) → { state, events }
                       │  deterministic event stream
                       ▼
                 Host Runtime     drives the engine on a browser clock (RAF),
                       │          reconciles time, exposes snapshots to React
                       │  forwards each dispatch's new events
                       ▼
                Event Runtime     event bus — subscribers react in priority
                       │          order, isolated from one another
                       │  events
                       ▼
                Coach Runtime     judgement — whether to speak, what to say,
                       │          when to stay quiet (no browser knowledge)
                       │  coaching actions → SpeechSink
                       ▼
                Media Runtime     the ONLY layer that touches the browser
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Speech        Bells      Wake Lock     (+ capabilities · visibility)

   Session Runtime — persistence & History, attached as an event subscriber
   (a plug-in the engine is unaware of), not a layer in the vertical flow.
```

Data flows **one way, downward**. Every arrow is an event or a narrow port; no
lower layer imports, calls, or knows about a higher one.

---

## Layer responsibilities

| Layer | Owns | Must not |
|---|---|---|
| **Execution Engine** | Timelines, the workout state machine (`idle · warmup · round · rest · finished` × `running · paused`), and a deterministic, monotonic event stream via a pure reducer. Time is derived from an injected clock. | Touch the browser, React, speech, or wall-clock time. |
| **Host Runtime** | The browser composition root: a real clock + `requestAnimationFrame` loop that advances the engine, reconciles elapsed time across visibility changes, and exposes immutable snapshots to React. | Be the source of truth for time (the engine is). Contain workout logic. |
| **Event Runtime** | A small event bus. Subscribers register with a priority and react synchronously, isolated by `try/catch`. This is the seam new capabilities plug into. | Let one subscriber see or break another. |
| **Coach Runtime** | Coaching judgement: a pipeline (Director → Silence → Planner → Queue → Sink) that decides, per event, whether/what/when to speak, varied deterministically by personality and coaching layer. Renders through a narrow `SpeechSink` port. | Import a browser API or synthesize speech itself. |
| **Media Runtime** | Every browser media concern: the `AudioContext`, the Speech API, the Wake Lock, capability detection, visibility, and graceful degradation. Provides the `SpeechSink`, rings bells, keeps the screen awake, unlocks audio from a gesture. | Decide *what* to say — it only decides whether/how the browser can play it. |
| **Session Runtime** | Persistence, checkpointing, resume, and History — as an event-subscriber plug-in. `localStorage` is touched in exactly one adapter, behind a versioned envelope. | Be known to the engine; re-speak the past on resume. |

---

## Dependency rules

1. **Downward-only.** A layer may depend on the layers below it (through events or a
   narrow port), never on the ones above. The Engine depends on nothing.
2. **The platform is framework-free.** Nothing under `src/lib/**` may import React or
   a browser API — **except the Media Runtime**, which is the single, deliberate
   place browser APIs live.
3. **Events add behaviour, not edits.** A new capability (a bell, a stat, a new coach)
   is a new **subscriber**, never a change to the engine or a cross-call between
   concerns.
4. **One port per boundary.** The Coach Runtime speaks only through `SpeechSink`; the
   Media Runtime exposes only that port upward. Boundaries are the interface.
5. **Determinism is a contract.** No `Date.now()`, `performance.now()`, or
   `Math.random()` in the Engine or Coach Runtime. Timing comes from injected clocks
   and event `elapsedMs`; variety comes from deterministic rotation.

## Why the Engine remains pure

The Engine is the heart, and it is kept free of the browser, React, speech, and
wall-clock time on purpose:

- **Trust.** The same event stream *always* produces the same coaching and the same
  timing. A coach that is deterministic is a coach that can be trusted — one mistimed
  countdown and the athlete stops believing anything.
- **Testability.** A pure reducer over an injected clock is exhaustively unit-tested
  under Node, with no browser and no flaky timers. The platform's 237 tests run in
  ~1.5s.
- **Portability.** With zero host dependencies, the same engine can drive a different
  frontend, a wearable, or a server without change — the host is swappable, the core
  is not.
- **Reasoning.** Every effect that could make behaviour non-reproducible (audio,
  speech, wake lock, storage) is pushed to the edges, so the core stays small and
  easy to reason about.

The unifying principle: **execution is deterministic, events drive behaviour, and
every boundary exists to make the platform easier to evolve.**
