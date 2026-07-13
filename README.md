# Corner

**The coach in your corner.** A hands-free boxing coach for the heavy bag —
press Start, put the phone down, and train.

> Status: pre-Beta (Internal Alpha). Runs locally; not yet publicly released.
> Deterministic platform, 237 passing tests. The coaching pipeline is operational
> end-to-end — a real workout is coached out loud, with bells, wake lock, and History.

---

## What Corner is

Corner is a web app that coaches a heavy-bag workout out loud. It calls the
rounds, keeps perfect time, and — through six distinct **Coach Packs** — talks you
through the work like a real trainer: cueing technique, marking the time
("one minute left"), reinforcing a lesson in fresh words, and knowing when silence
teaches more than talk.

It is not another interval timer with a beep. It is an attempt to put a coach in
the room.

## Why it exists

A simple observation:

> Many people own a heavy bag. Very few people have a coach.
> Most workout apps measure time. Corner tries to teach boxing.

The goal is to become the coach standing in your corner after you press Start and
put the phone down. Everything in the architecture serves that one promise.
The longer story is in **[VISION.md](VISION.md)**.

## Who it's for

- People training alone on a heavy bag who want guidance, not just a clock.
- Beginners who don't know what to do next — and improvers who want to be pushed.
- Southpaws, who are badly served by almost every other app.
- Coaches and writers who want to author workouts and coaching voices.

## The promise

**Press Start. Put the phone down. Trust the coach.**

Hands-free by design: the voice is the product, the screen is a caption. You should
never need to look at or touch the phone once a round begins.

## Philosophy

- **Trust is the product.** Perfect timing, honest coaching, never a claim to see
  what it can't. One mistimed countdown and the athlete stops believing anything.
- **Silence is coaching.** A great corner is quiet most of the round. Corner aims
  for ~60–70% silence and speaks only to change the next action.
- **Coaching is judgement, not narration.** The coach decides *whether*, *what*,
  and *when* to speak — it doesn't read a script.

See **[docs/product/COACHING_PHILOSOPHY.md](docs/product/COACHING_PHILOSOPHY.md)**.

## Architecture at a glance

Corner is a layered, deterministic platform. Each layer has one job and knows
nothing about the layers above it.

```
Execution Engine → Host Runtime → Event Runtime → Coach Runtime → Media Runtime → Browser
   (pure time)      (RAF loop)      (event bus)     (judgement)     (speech/audio/wake-lock)
```

- **Execution Engine** — pure, deterministic domain: timelines, the workout state
  machine, and an immutable event stream. No browser, no React, no speech.
- **Host Runtime** — drives the engine on a browser clock and forwards events.
- **Event Runtime** — a small event bus; subscribers react in priority order.
- **Coach Runtime** — turns events into intentional coaching (what to say, when,
  and when to stay quiet). No browser knowledge.
- **Media Runtime** — the only layer that touches the browser: Speech, Web Audio,
  Wake Lock, capabilities, visibility.

A high-level tour is in **[ARCHITECTURE.md](ARCHITECTURE.md)**; the canonical snapshot
and dependency rules are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**; the
principles behind the boundaries are in
**[docs/ARCHITECTURE_PRINCIPLES.md](docs/ARCHITECTURE_PRINCIPLES.md)**; and the detailed
design lives under [`docs/architecture/`](docs/architecture/).

## Current Platform

The implemented stack, wired end-to-end:

| Layer / capability | Status |
|---|---|
| Execution Engine (pure domain, state machine, events) | ✓ |
| Host Runtime (browser clock + RAF loop) | ✓ |
| Event Runtime (priority event bus) | ✓ |
| Coach Runtime (judgement: what/when to say) | ✓ |
| Media Runtime (browser boundary) | ✓ |
| Session Runtime (persistence plug-in) | ✓ |
| Persistence (versioned `localStorage` repository) | ✓ |
| History (completed sessions, ratings) | ✓ |
| Speech (heard end-to-end; lifecycle defect resolved) | ✓ |
| Wake Lock (screen kept awake, re-acquired on visibility) | ✓ |

## Current status

Feature-complete for the current milestone and in **Internal Alpha**. The full
platform is wired end-to-end: a real workout is coached out loud, with bells, a
screen wake-lock, History, and graceful degradation on browsers missing a
capability. The coaching pipeline is operational; the speech-lifecycle investigation
is resolved (see **[docs/ENGINEERING_JOURNEY.md](docs/ENGINEERING_JOURNEY.md)**). The
next milestone is a first athlete on a real bag — readiness is tracked in
**[docs/BETA_READY.md](docs/BETA_READY.md)**. See also **[ROADMAP.md](ROADMAP.md)**.

## Run locally

Requirements: **Node 20+** and **pnpm**.

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Other scripts:

```bash
pnpm test       # run the test suite (Vitest, Node environment — no browser needed)
pnpm build      # production build
```

Stack: Next.js 16 (App Router), React 19, TypeScript 5.7 (strict), Tailwind CSS v4,
Vitest. The platform (`src/lib/`) is framework-free and runs under Node.

## Contributing

Contributions are welcome — code, workouts, and coaching voices alike. Start with
**[CONTRIBUTING.md](CONTRIBUTING.md)**. In short: respect the architectural
boundaries, keep the coaching philosophy consistent, and document decisions.

- Write a workout → [docs/workouts/AUTHORING_GUIDE.md](docs/workouts/AUTHORING_GUIDE.md)
- Write a Coach Pack → [docs/coaching/PERSONALITY_SYSTEM.md](docs/coaching/PERSONALITY_SYSTEM.md)

By participating you agree to the **[Code of Conduct](CODE_OF_CONDUCT.md)**.

## Roadmap

Done: the platform, product design, content framework, coach performance system,
and the media runtime. Next: first athlete → closed beta → public beta → 1.0.
Later: wearables, cloud sync, a coach marketplace, and AI-assisted coaching. Full
picture in **[ROADMAP.md](ROADMAP.md)**.

## License

MIT — see **[LICENSE.md](LICENSE.md)**.
