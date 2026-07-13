# Architecture

A high-level tour of the Corner platform. This is the map, not the territory —
detailed design docs live under [`docs/architecture/`](docs/architecture/),
[`docs/coaching-runtime/`](docs/coaching-runtime/), and
[`docs/media-runtime/`](docs/media-runtime/), and are linked from each section.

---

## The shape

Corner is a **layered, deterministic platform**. Data flows one way: the engine
produces events, and each layer above reacts to them. Nothing lower ever depends on
anything higher.

```
┌─────────────────┐  pure domain: timelines, state machine, immutable events
│ Execution Engine│  (no browser · no React · no speech)
└────────┬────────┘
         │ events
┌────────▼────────┐  drives the engine on a browser clock; forwards each dispatch
│  Host Runtime   │  (RAF loop · visibility · time reconciliation)
└────────┬────────┘
         │ events
┌────────▼────────┐  a small event bus; subscribers react in priority order,
│  Event Runtime  │  isolated from one another
└────────┬────────┘
         │ events
┌────────▼────────┐  turns events into intentional coaching — whether to speak,
│  Coach Runtime  │  what to say, when to stay quiet (no browser knowledge)
└────────┬────────┘
         │ coaching actions
┌────────▼────────┐  the ONLY layer that touches the browser: Speech, Web Audio,
│  Media Runtime  │  Wake Lock, capabilities, visibility
└────────┬────────┘
         │
     Browser APIs

Session Runtime — persistence/checkpointing, as an event subscriber (a plug-in,
not a layer the engine knows about).
```

## The layers

### Execution Engine — [`docs/architecture/ENGINE.md`](docs/architecture/ENGINE.md)
The pure heart. Given an immutable `WorkoutConfig`, it builds a **Timeline** and
runs a **state machine** (`idle · warmup · round · rest · finished` × `running ·
paused`) via a pure reducer `(state, command) → { state, events }`. Time is derived
from an injected clock; the output is a deterministic, monotonic **event stream**.
It has zero dependencies — no browser, no React, no speech — and runs under Node.
See also [STATE_MACHINE.md](docs/architecture/STATE_MACHINE.md) and
[EVENT_MODEL.md](docs/architecture/EVENT_MODEL.md).

### Host Runtime
The browser composition root. It wires a real clock and a `requestAnimationFrame`
loop around the engine, advances it, reconciles elapsed time across visibility
changes, exposes immutable snapshots to React, and forwards each dispatch's new
events to the Event Runtime. RAF is never the source of truth for time — the engine
is.

### Event Runtime
A minimal **event bus**. The engine emits; subscribers (coaching, bells,
persistence, logging, stats) register with a priority and react synchronously,
isolated by `try/catch` so one bad subscriber can't break another. This is the seam
that lets capabilities be added without touching the engine.

### Coach Runtime — [`docs/coaching-runtime/IMPLEMENTATION.md`](docs/coaching-runtime/IMPLEMENTATION.md)
The coach's judgement, as a subscriber. A pipeline — Director → Silence → Planner →
Queue → Sink — decides, per event, whether to speak, what to say (rotated by
personality and coaching layer), and when to stay quiet. It renders through a
narrow `SpeechSink` port and never imports a browser API. Cadence, reinforcement,
and time-awareness are in [CADENCE_REFINEMENT.md](docs/coaching-runtime/CADENCE_REFINEMENT.md).

### Media Runtime — [`docs/media-runtime/IMPLEMENTATION.md`](docs/media-runtime/IMPLEMENTATION.md)
The browser boundary. It owns the `AudioContext`, the Speech API, the Wake Lock,
capability detection, and visibility handling — so nothing above it touches a
browser media API. It provides the `SpeechSink` the Coach Runtime renders into,
rings the bells, keeps the screen awake, unlocks audio from a user gesture, and
degrades gracefully where a capability is missing.

### Session Runtime
Persistence and checkpointing (save, resume, history), implemented as an **event
subscriber plug-in**. `localStorage` is touched in exactly one adapter; the engine
is unaware persistence exists. Resume replays deterministically without re-speaking
the past.

## Why the boundaries exist

Each boundary buys a specific freedom to evolve:

- **The engine knows nothing about the UI or speech.** It can be tested exhaustively
  under Node, reasoned about in isolation, and reused on any host (a different
  frontend, a wearable, a server) without change.
- **Events, not calls, drive behaviour.** New capabilities (a new bell, stats, a new
  coach) are new subscribers, not edits to the core. Concerns never learn about each
  other.
- **Content owns coaching; the Coach Runtime owns judgement.** *What* a coach could
  say lives in authored content (workouts, cue libraries, coach packs); *whether and
  when* it's said is the runtime's decision. Either can change without the other.
- **Media owns the browser.** Every autoplay quirk, wake-lock oddity, and missing API
  is contained in one layer, so the rest of the platform stays clean and portable.

The unifying principle: **execution is deterministic, events drive behaviour, and
every boundary exists to make the platform easier to evolve.** The same event stream
always produces the same coaching — which is what makes the system testable, and
what makes the coach trustworthy.

## Where design decisions live

Architecture decisions are recorded as ADRs and a decision log under
[`docs/architecture/`](docs/architecture/) — start with
[ADR-0001](docs/architecture/ADR-0001-workout-engine.md) and
[DECISIONS.md](docs/architecture/DECISIONS.md). New significant decisions should be
added there (see [CONTRIBUTING.md](CONTRIBUTING.md)).
