# Contributing to Corner

Thank you for considering a contribution. Corner welcomes code, workouts, and
coaching voices. This guide explains how the project is organised and how to add to
it without breaking the two things that matter most: **determinism** and **trust**.

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Repository structure

```
app/                 Next.js App Router pages (thin; compose components + hooks)
components/          React UI (Workout screen, cards, shared primitives)
hooks/               React state/composition (e.g. useCoachedWorkout — the wiring)
src/lib/             The platform — framework-free, runs under Node:
  engine/              Execution Engine (pure domain, state machine, events)
  host/                Host Runtime (browser clock + RAF loop)
  runtime/             Event Runtime (event bus + subscribers)
  coaching/            Coach Runtime (judgement: what to say, when)
  session/             Session Runtime (persistence/checkpointing plug-in)
  media/               Media Runtime (browser: speech, audio, wake lock)
  integration/         Corner-specific wiring (app Workout → engine config)
lib/                 App utilities + the speech stack (SpeechService)
src/tests/           Vitest tests (Node environment; no browser)
data/                Seeded workouts
docs/                Design docs, ADRs, product + coaching + content frameworks
```

## Coding principles

- **TypeScript, strict.** No new `any`; keep the type surface honest.
- **The platform is framework-free.** Nothing in `src/lib/**` may import React or a
  browser API — except the Media Runtime, which is the one place browser APIs live.
- **Deterministic, always.** No `Date.now()`, `performance.now()`, or `Math.random()`
  inside the engine or Coach Runtime. Timing comes from injected clocks / event
  `elapsedMs`; variety comes from deterministic rotation, never RNG.
- **Match the surrounding code.** Comment density, naming, and idiom should look like
  the file you're editing.
- **Tests come with changes.** Platform code is thoroughly unit-tested and runs
  headless — keep it that way (`pnpm test`).

## Architectural boundaries (please respect these)

Data flows one way — see [ARCHITECTURE.md](ARCHITECTURE.md). The boundaries are the
whole point:

- **The Engine knows nothing about UI or speech.** Don't reach into it from a
  component, and don't add browser concerns to it.
- **Events drive behaviour.** New capability = a new event **subscriber**, not an
  edit to the engine or a cross-call between concerns.
- **Content owns coaching; the Coach Runtime owns judgement.** *What* could be said
  is authored content; *whether/when* it's said is the runtime's decision.
- **Media owns the browser.** Autoplay, wake lock, and missing-API handling belong in
  the Media Runtime, nowhere else.

If a change seems to require crossing a boundary, that's usually a sign to reconsider
the approach — or to propose the boundary change explicitly (below).

## How decisions are documented

Significant design decisions are **Architecture Decision Records** under
[`docs/architecture/`](docs/architecture/), with a running
[DECISIONS.md](docs/architecture/DECISIONS.md) log. If your change alters an
architectural boundary, a public contract, or a platform invariant, add or amend an
ADR in the same PR and link it. Small, local changes don't need one.

## How to propose changes

1. **Open an issue first** for anything non-trivial — describe the problem and the
   intended approach, so we can agree on direction before code.
2. **Branch** from `main`.
3. Keep PRs **focused and small**. One concern per PR.
4. Ensure `pnpm test`, `pnpm build`, and type-checking pass.
5. Write a clear PR description: what changed, why, and how it was verified. Link any
   issue or ADR.
6. Be ready to iterate in review. Boundaries and determinism will be checked.

## How to write a new workout

Workouts are **content**, not code. The full guide is
[docs/workouts/AUTHORING_GUIDE.md](docs/workouts/AUTHORING_GUIDE.md); the shape is in
[WORKOUT_SCHEMA.md](docs/workouts/WORKOUT_SCHEMA.md). In brief:

- Give the session **one clear objective**; build the rounds toward it.
- Assemble rounds from the [Round Library](docs/workouts/ROUND_LIBRARY.md) and cues
  from the [Cue Library](docs/workouts/CUE_LIBRARY.md) — real boxing language, one
  idea per cue, timed to leave the athlete room to work.
- Respect cadence and silence (~one coaching cue per 20–40s of work). Let the coach
  breathe.
- Run it through the [Quality Checklist](docs/workouts/QUALITY_CHECKLIST.md), and use
  the [Foundations Pack](docs/workouts/FIRST_WORKOUT_PACK.md) as the reference bar.

## How to write a new Coach Pack

A Coach Pack is a **personality**, not a voice skin. The model is
[docs/coaching/PERSONALITY_SYSTEM.md](docs/coaching/PERSONALITY_SYSTEM.md); the six
existing packs live in code at `src/lib/coaching/personalities.ts` (with anchor and
reinforcement wording in `anchors.ts` / `reinforcements.ts`). A pack defines
teaching philosophy, temperament, vocabulary, humour, intensity, and framing lines —
the *same* correct boxing, a different human. Provide several rotating variants per
line so the coach never loops.

## Keeping the coaching philosophy consistent

Every workout and coach must honour the non-negotiables (see
[docs/product/COACHING_PHILOSOPHY.md](docs/product/COACHING_PHILOSOPHY.md),
[VOICE_GUIDELINES.md](docs/product/VOICE_GUIDELINES.md), and the performance docs in
[`docs/coaching/`](docs/coaching/)):

- **Perfect timing** on the countdown and bell — always exact.
- **Never claim to see the athlete.** Universal reminders only.
- **Never shame, never unsafe, never break character** into app-speak.
- **Silence is coaching.** Earn every line; leave most of the round quiet.
- **Trust is the product.** When in doubt, say less and be honest.

Content that's schema-valid but violates these isn't a Corner contribution — the
[Quality Checklist](docs/workouts/QUALITY_CHECKLIST.md) is the gate.

---

Not sure where to start? Improving a workout, adding a coach-pack variant, or
tightening docs are all excellent first contributions. Welcome to the corner.
