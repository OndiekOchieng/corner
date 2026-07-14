# 🥊 Corner

> **Press Start.**
> **Put the phone down.**
> **Trust your coach.**

Corner is a hands-free boxing coach for the heavy bag. It is engineered around
**deterministic coaching** — deciding *whether, what, and when* to speak from a
workout timeline — rather than playing back a fixed interval track. Press Start,
pocket the phone, and train: the coach calls the rounds, keeps exact time, teaches
technique, reinforces a lesson in fresh words, and stays quiet when quiet is what
coaches.

> Status: **Internal Alpha** — runs locally, coached end-to-end. Deterministic
> platform, **282 passing tests**, framework-free core.

---

## Why Corner?

Most boxing apps are interval timers: a bell, a countdown, maybe a canned "work!".
They measure time. They don't coach.

Corner was designed the other way around — coaching first. It reasons about the
session as a coach would, deciding:

- **when to teach** a technique, and when the athlete has no spare attention for it,
- **when to stay silent** — a great corner is quiet most of the round,
- **when to reinforce** a lesson in different words instead of repeating it,
- **when to let the athlete recover** during rest,
- **when to push**, and
- **when *not* to interrupt** rhythm or a countdown.

The objective is to recreate the feeling of having an experienced coach standing in
your corner — not a stopwatch that talks.

## Core principles

- 🥊 **Hands-free first** — the voice is the product; the screen is a caption.
- 🎯 **Coaching over narration** — every line changes the next action, or it isn't said.
- 🤫 **Silence is coaching** — quiet is an active decision, not dead air.
- ⏱ **Timing is sacred** — countdowns and bells are exact, always.
- 🧠 **Deterministic behaviour** — same workout in, same coaching out. No randomness, no AI.
- 🧩 **Clear architectural boundaries** — each layer has one job and knows nothing of the layers above it.

## Architecture

Corner is a layered, deterministic platform. Data flows one way — down. Each layer
depends only on the ones below it, through events or a narrow port.

```
        Workout authoring        (content: rounds, cues, combinations, focus)
                │
        Execution Engine         pure domain — timeline + state machine + event stream
                │
        Host Runtime             drives the engine on a browser clock (RAF); forwards events
                │
        Event Runtime            priority event bus; subscribers react, isolated
                │
        Coach Runtime            judgement — whether / what / when to speak
                │
        Media Runtime            the only layer that touches the browser
                │
        ┌───────┼───────┐
     Speech    Bells   Wake Lock
```

- **Execution Engine** — pure, deterministic: an immutable timeline, the workout
  state machine, and a monotonic event stream. No browser, no React, no speech.
- **Host Runtime** — runs the engine on a real clock + `requestAnimationFrame` loop,
  reconciles time across visibility changes, and exposes snapshots to the UI.
- **Event Runtime** — a small event bus; capabilities attach as subscribers.
- **Coach Runtime** — turns events into intentional coaching, deterministically. It
  never imports a browser API.
- **Media Runtime** — owns every browser concern: the Speech API, Web Audio bells,
  the Wake Lock, capability detection, and graceful degradation.

**The Engine executes. The Coach decides. The Media delivers.** A full tour is in
[ARCHITECTURE.md](ARCHITECTURE.md); the canonical diagram and dependency rules are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Current capabilities

Shipped and wired end-to-end (a real workout is coached out loud today):

- ✅ **Deterministic Workout Engine** — pure timeline + state machine + event stream
- ✅ **Host & Event Runtime** — RAF loop, time reconciliation, priority event bus
- ✅ **Coach Runtime** — Director → Silence → Planner → Queue → Sink
- ✅ **Media Runtime** — speech, bells, wake lock, capabilities, degradation
- ✅ **Session Persistence** — versioned `localStorage` repository, resume-safe
- ✅ **Local Workout History** — completed sessions with coach, duration, rounds, rating
- ✅ **Coach Personalities** — six distinct Coach Packs
- ✅ **Coaching Memory** — remembers what has been taught, not dialogue
- ✅ **Reinforcement** — the same lesson in fresh words, never identical repetition
- ✅ **Boxing Lexicon** — authentic call signs, combinations, per-pack expression
- ✅ **Semantic Cue Authoring** — cues carry structured intent, not just text
- ✅ **Voice Readiness** — the first line is spoken in the chosen coach voice
- ✅ **Temporal Coaching Consistency** — speech is a live view of the timeline

## What makes Corner different?

The interesting engineering is in the coaching, and it is achieved **without AI** —
deterministic policy over a real timeline:

- **Semantic workout authoring** — a cue is structured intent (a combination `[1,2,6]`,
  a focus, a dimension), not a fixed sentence. Authors describe *what*; the coach
  renders *how*.
- **Coaching memory** — the coach remembers which concepts and which vocabulary it has
  taught this session, and builds on them.
- **Reinforcement instead of repetition** — "Keep your hands high" becomes "Don't let
  them drop", then "Protect yourself" — the lesson, re-voiced, never looped.
- **Vocabulary progression** — call signs are taught before they're assumed
  ("every time I say *one*, I mean the jab"), so the athlete learns boxing language by
  training.
- **Coach personalities** — the same workout, coached by two packs, feels like two
  different humans who know the same boxing.
- **Temporal consistency** — expired coaching is discarded, a round is introduced once,
  and a line is skipped rather than started when the countdown is about to interrupt it.
- **Determinism** — the same event stream always produces the same coaching, which is
  what makes it both testable and trustworthy.

## Design principles

The architectural north star. New contributions are reviewed against these:

- **The Engine never knows audio exists.**
- **The Coach Runtime never knows browsers exist.**
- **The Media Runtime never knows boxing.**
- **Speech may be skipped, but never rushed** — a line that can't finish before the
  countdown is dropped, not cut off.
- **Coaching always describes the current moment** — speech is a live view of the
  timeline, never a replayed recording.
- **Silence is an active coaching decision**, budgeted like any spoken line.
- **Workouts describe *what* to teach. Coach Packs decide *how*. The Coach Runtime
  decides *when*.**
- **Determinism is a contract** — no wall clock, no randomness in the Engine or Coach.

More detail: [docs/ARCHITECTURE_PRINCIPLES.md](docs/ARCHITECTURE_PRINCIPLES.md).

## Repository structure

```
src/lib/engine/     Execution Engine — pure domain, state machine, event stream
src/lib/host/       Host Runtime — browser clock + RAF loop + time reconciliation
src/lib/runtime/    Event Runtime — the event bus + subscriber plumbing
src/lib/coaching/   Coach Runtime — judgement, memory, reinforcement, lexicon
src/lib/media/      Media Runtime — speech, bells, wake lock, capabilities
src/lib/session/    Session Runtime — persistence + History, as an event subscriber
src/lib/integration/  Corner-specific wiring (app Workout → engine config)
app/ · components/ · hooks/   Next.js UI and the composition root
data/               Seeded workouts
docs/               Architecture, coaching, product, and workout-authoring docs
src/tests/          Vitest tests (Node environment; no browser needed)
```

The platform under `src/lib/**` is framework-free and runs under Node — everything
except the Media Runtime is free of browser and React dependencies.

## Getting started

Requirements: **Node 20+** and **pnpm**.

```bash
git clone git@github.com:OndiekOchieng/corner.git
cd corner
pnpm install
pnpm dev        # http://localhost:3000

pnpm test       # run the test suite (Vitest, Node — no browser needed)
pnpm build      # production build
```

Stack: Next.js 16 (App Router), React 19, TypeScript 5.7 (strict), Tailwind CSS v4,
Vitest.

## Roadmap

**Near term**

- Real-device beta testing (iOS Safari, Chrome Android) on a real bag
- Coach polish — more variants, tighter cadence
- A larger workout library
- Better / configurable voices

**Long term**

- Adaptive coaching (deferred until it can be done without compromising trust)
- Wearables — off the screen entirely
- Cloud sync across devices
- Community-authored workout and coach packs

Full picture in [ROADMAP.md](ROADMAP.md); near-term readiness in
[docs/BETA_READY.md](docs/BETA_READY.md).

## Contributing

Corner is a good project if you care about **software architecture**, **sports
technology**, **human–computer interaction**, or **boxing coaching** — code,
workouts, and coaching voices are all welcome.

The one rule that matters most: **respect the architectural boundaries.** The Engine
stays pure, the Coach stays browser-free, the Media layer owns the browser, and
determinism is never traded away. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and
the [design principles](docs/ARCHITECTURE_PRINCIPLES.md).

- Write a workout → [docs/workouts/AUTHORING_GUIDE.md](docs/workouts/AUTHORING_GUIDE.md)
- Write a Coach Pack → [docs/coaching/PERSONALITY_SYSTEM.md](docs/coaching/PERSONALITY_SYSTEM.md)
- Follow the project's evolution → [docs/ENGINEERING_JOURNEY.md](docs/ENGINEERING_JOURNEY.md)

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE.md](LICENSE.md).
