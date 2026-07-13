# Roadmap

Where Corner has been, where it is, and where it's going. Direction, not dates.
Detailed planning lives in [`docs/`](docs/) — see [docs/BETA_READY.md](docs/BETA_READY.md)
for the near-term checklist and the product docs for the long view; this is the
public map.

The measure never changes: *an athlete presses Start, puts the phone down, and
finishes feeling coached.*

---

## ✅ Completed

The platform is built, wired end-to-end, tested (237 passing), and coaches a real
workout out loud today.

- **Platform** — the deterministic core: Execution Engine, Host Runtime, Event
  Runtime, and Session Runtime. Pure, event-driven, exhaustively tested.
- **Product** — the coaching philosophy, voice guidelines, workout design, coach
  packs, and user journeys. The *why* and the *how it should feel*.
- **Content** — the workout authoring framework: schema, round and cue libraries,
  progression model, quality checklist, and a first Foundations pack.
- **Coach Runtime** — judgement over narration, silence as a tool, personality, time
  anchors, and reinforcement. Six recognisable coaches. **Operational end-to-end.**
- **Media Runtime** — speech, bells, wake lock, capability detection, and graceful
  degradation. The coach is actually heard.
- **Sessions & History** — durable sessions, checkpoint/resume, and a History page
  reading from the repository (cancel does not enter History).
- **Speech lifecycle** — a full forensic investigation resolved the StrictMode
  disposal defect that silenced the coach; the browser speech pipeline is verified.

## ▶ Current — Internal Alpha

The whole platform runs a real, coached workout locally. We're using it ourselves:
tightening cadence, tuning coach voices against real rounds, and hardening the
browser experience across devices. Full status in [docs/BETA_READY.md](docs/BETA_READY.md).

## ⏭ Next — grouped by track

### Beta Readiness (the gate to a first athlete)
- **Real device testing** — structured passes on iOS Safari and Chrome Android on a
  real bag; confirm the production speech path is audible on-device.
- **Lock screen / background behaviour** — audio continuity when the screen locks or
  the tab backgrounds; the open **ADR-0003 (background tick source)** blocker.
- **Offline support** — service worker / installable PWA so a workout runs with no
  connection at the bag.

### Product
- **Coach packs expansion** — more recognisable coaches; more rotating variants so no
  coach ever loops.
- **Workout catalogue** — grow beyond Foundations across levels, stances, and goals.
- **First Athlete → Closed Beta → Public Beta → 1.0** — put it in front of real
  people, validate trust in the wild, then open it up.

### Platform
- **Analytics** — minimal, privacy-respecting instrumentation of real usage.
- **App Store / Play Store preparation** — packaging, listings, permissions, review.
- **Continued hardening** — cross-browser edge cases, accessibility, error boundaries.

### Future Research (beyond 1.0)
Pursued only when they can be done without compromising determinism or trust.

- **Wearables** — off the screen entirely; a voice from a watch or earbuds.
- **Cloud sync** — your coach and progress on any device.
- **Coach marketplace** — real coaches author and share workouts and personalities.
- **Adaptive / AI-assisted coaching** — **explicitly deferred.** Coaching that reacts
  to how you're actually moving (HR-gated segments, punch-count termination, real-time
  retiming) stays on the shelf per [ADR-0002](docs/architecture/ADR-0002-adaptive-vs-deterministic-execution.md);
  it is *deferred, not rejected*, and re-opens only when a committed feature needs it.

---

Corner starts as a coach for the heavy bag. The direction is simple: make that coach
so good, and so present, that you forget you're listening to software.
