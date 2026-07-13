# Architecture Principles

The engineering philosophy that emerged while building Corner. These are not
aspirations — each was paid for by a concrete problem and is enforced by the code
today. They are the lens for reviewing any future change. When a proposal is hard to
place against these, that is usually the signal to reconsider the approach.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how these principles are realised as
layers, and [CONTRIBUTING.md](../CONTRIBUTING.md) for how they gate contributions.

---

### 1. The Engine owns time
A running workout has exactly one time source: an injected clock, anchored to a
monotonic reference. Display, cue timing, and phase transitions are all *derived*
from elapsed time — never accumulated per frame, never counted by the UI. Drop a
frame, suspend the tab, come back: the time is still correct.

### 2. The UI never derives workout state
Components render immutable snapshots; they do not compute "did we cross a boundary?"
or "what round is it?" from raw values. The state machine decides; React displays.
This killed a whole class of bugs where six polling effects each re-derived the phase
slightly differently.

### 3. Events are immutable
The engine emits a deterministic, monotonic stream of immutable events. Behaviour is
built by *reacting* to that stream, not by mutating shared state. The same events
always replay to the same result — the foundation of both testing and resume.

### 4. Browser APIs stay at the edge
Speech, Web Audio, Wake Lock, `localStorage`, visibility — every non-deterministic,
host-specific concern lives in exactly one layer (Media Runtime) or one adapter
(Session Runtime). The other 90% of the platform is framework-free and runs under
Node. *This principle is why the speech-lifecycle bug was findable at all:* the
failure was isolated to one boundary.

### 5. Coaching is policy, not execution
*What* a coach could say is authored content (workouts, cue libraries, coach packs).
*Whether, what, and when* it is actually said is the Coach Runtime's judgement. The
runtime never synthesizes audio; the media layer never decides words. Either can
change without touching the other.

### 6. Determinism is a contract, not a preference
No `Date.now()`, `performance.now()`, or `Math.random()` in the Engine or Coach
Runtime. Timing comes from injected clocks and event `elapsedMs`; variety comes from
deterministic rotation counters. A trustworthy coach is a reproducible one.

### 7. Prefer explicit ownership
Every resource has one owner with a clear lifecycle. The speech silence traced to a
violation of this: `window.speechSynthesis` is a global, and a per-instance teardown
was cancelling it out from under another instance. The fix was to make disposal
instance-local — own only what you created.

### 8. Build seams before features
The extension points came first: an event bus before subscribers, a `SpeechSink`
port before the Media Runtime, versioned persistence envelopes before History. New
capability arrives as a new subscriber or a new implementation of an existing port —
not as an edit to the core. Adding features is cheap because the seams already exist.

### 9. Silence is a feature, not an absence
Applies to the product (a great corner is quiet most of the round) *and* the code
(the smallest change that honours the boundaries beats the clever one that blurs
them). Earn every line, in speech and in source.

### 10. Product before cleverness
The measure is always: *an athlete presses Start, puts the phone down, and finishes
feeling coached.* Adaptive execution, event sourcing, and AI retiming are all
technically interesting and all **deliberately deferred** because the committed
product does not need them yet (see [ADR-0002](architecture/ADR-0002-adaptive-vs-deterministic-execution.md)).
Complexity is added only when a real feature demands it.

---

**The through-line:** determinism buys trust, boundaries buy evolvability, and both
serve the one promise — a coach worth putting the phone down for.
