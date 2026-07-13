# Engineering Journey

The evolution of Corner, PR by PR: what each one set out to do, what it delivered,
and the architectural decision that mattered. This is the project's historical
record — read top to bottom, it is the story of how a beeping timer became a coach.

> On numbering: PR-006 → PR-019 are the tracked delivery PRs of this phase and are
> recorded verbatim. PR-001 → PR-005 are the foundational engine track, reconstructed
> from the ADRs and [`IMPLEMENTATION_PLAN.md`](architecture/IMPLEMENTATION_PLAN.md);
> their boundaries are approximate but their outcomes are real and in the code.

---

## Foundations — the deterministic core

### PR-001 — Workout Engine & Coaching (v1)
- **Goal:** A working hands-free heavy-bag runner — rounds, timing, bells, and a
  coach that speaks.
- **Outcome:** The first end-to-end coaching flow (legacy engine + `CoachEngine` +
  `SpeechService` over `MockSpeechSynthesis`). It worked, but timing and speech were
  spread across hooks, effects, and manager classes.
- **Decision:** Establish `SpeechService` as the single boundary to the Web Speech
  API, tested through an injected mock — the seam that survived every later rewrite.

### PR-002 — Engine Architecture & Migration Design
- **Goal:** Decide how to make execution trustworthy and testable before writing more
  features.
- **Outcome:** [ADR-0001](architecture/ADR-0001-workout-engine.md) (pure engine
  baseline), the [ADR-0002](architecture/ADR-0002-adaptive-vs-deterministic-execution.md)
  adaptive proposal **and** its dissent, and a parity-first migration plan.
- **Decision:** **Determinism over adaptivity.** ADR-0002 (event sourcing, adaptive
  retiming) was *deferred, not rejected*; a fixed-timeline, pure-reducer core became
  the baseline. Product need, not technical allure, sets the complexity budget.

### PR-003 — Pure Engine Core
- **Goal:** Build the engine as a framework-free domain with no app wiring.
- **Outcome:** `config` → `timeline` → pure `reducer (state, command) → { state,
  events }`, an injected `clock`, an event bus, and first-class `WorkoutSession` —
  all exhaustively unit-tested under Node.
- **Decision:** The reducer emits a **deterministic event stream**; time is derived
  from an injected clock, never counted per frame. The engine knows nothing above it.

### PR-004 — Host Runtime & Cutover
- **Goal:** Drive the pure engine in the browser and replace the legacy path.
- **Outcome:** Host Runtime (RAF loop + visibility/time reconciliation), the Event
  Runtime bus with priority subscribers (coach, bells, stats), and the active route
  rewired behind the new host — legacy timer deleted, parity harness green.
- **Decision:** RAF is a *pump*, never the source of truth. Capabilities attach as
  **event subscribers**, so the core never grows to accommodate them.

### PR-005 — Wake Lock & Platform Stability
- **Goal:** Keep the screen awake for the core use case; harden the runtime.
- **Outcome:** A `WakeLockSubscriber` as progressive enhancement (no correctness
  dependency) and a platform stability review.
- **Decision:** Screen-off audio is a *timeliness*, not *correctness*, concern — the
  engine stays correct regardless; Wake Lock serves the phone-down use case.

---

## Product, coaching & media

### PR-006 — Session Persistence Foundation
- **Goal:** Give sessions durable identity and lay the History groundwork.
- **Outcome:** `SessionRepository` and the versioned persistence envelope; sessions
  checkpoint and resume deterministically.
- **Decision:** Persistence is an **event-subscriber plug-in** touching `localStorage`
  in exactly one adapter — the engine remains unaware storage exists.

### PR-007 — Coach Performance System (design)
- **Goal:** Define what "great coaching" means before implementing it.
- **Outcome:** The `docs/coaching/` corpus — performance model, timing, round
  directing, conversation patterns, motivation, the silence guide, the personality
  system, and a first coach performance pack.
- **Decision:** **Coaching is judgement, not narration.** Silence (~60–70% of a round)
  is a first-class tool. This design constrained every line the runtime would later say.

### PR-008 — Experience Polish
- **Goal:** Make the mobile experience premium without diluting the timer.
- **Outcome:** A design-system pass, accessibility review, and refined workout UI —
  with the timer kept dominant.
- **Decision:** The **voice is the product, the screen is a caption.** UI hierarchy
  serves the hands-free promise.

### PR-009 — Coach Runtime (implementation)
- **Goal:** Turn the coaching philosophy into a deterministic runtime.
- **Outcome:** `src/lib/coaching/` — Director → Silence → Planner → Queue → Sink —
  producing intentional coaching from the event stream, then wired into the live app,
  retiring the legacy coaching path.
- **Decision:** No randomness, no AI. Variety comes from **deterministic rotation**;
  the runtime renders through a narrow `SpeechSink` and never imports a browser API.

### PR-010 — Media Runtime & Execution Continuity
- **Goal:** Isolate every browser media concern behind one boundary.
- **Outcome:** `src/lib/media/` — `MediaRuntime`, Audio/Speech/WakeLock managers,
  capability service, diagnostics, and the plugin — owning speech, bells, wake lock,
  and graceful degradation.
- **Decision:** The Media Runtime is the **single place browser APIs live**; it
  provides the `SpeechSink` the coach renders into and decides only whether/how the
  browser can play, never what to say.

### PR-011 — Public Repository Preparation
- **Goal:** Make the project legible and welcoming to contributors.
- **Outcome:** README, CONTRIBUTING, ARCHITECTURE, VISION, ROADMAP, Code of Conduct,
  and license; the repository initialised and published.
- **Decision:** Boundaries and the coaching philosophy are documented as
  contribution gates — the architecture is the contract.

### PR-012 — Session Persistence Verification & History Wiring
- **Goal:** Wire the existing Session Runtime into the live app and surface History.
- **Outcome:** History shows workout, coach, duration, completed rounds, date, and
  rating, reading from the repository.
- **Decision:** **Cancel does not enter History.** `WORKOUT_CANCELLED` routes to a
  `discard()` (clear active only); one persistence mechanism, reused, never a second.

---

## Cross-platform & the speech investigation

### PR-013 — Cross-Platform Compatibility Audit
- **Goal:** Fix real-device failures on iOS and macOS.
- **Outcome:** iOS start-up unblocked (timer no longer stuck at 00:00), layout/safe-area
  fixes, and dev-only diagnostics. Root cause: `controller.start()` was gated on an
  audio-unlock promise that stays pending on iOS.
- **Decision:** **Never gate the workout on audio unlock.** Start the engine
  unconditionally; unlock audio in parallel and re-attempt from a gesture.

### PR-014 — Speech Pipeline Trace
- **Goal:** Explain why Chrome Android was silent despite healthy diagnostics.
- **Outcome:** Full boundary instrumentation (instance ids, per-boundary counters,
  `onstart/onend/onerror`) proving speech reached `speechSynthesis.speak()` but never
  started. First hypothesis: the Chrome gesture-activation gate; a gesture primer added.
- **Decision:** Instrument every boundary with cheap counters; strip them from
  production via inline `NODE_ENV` checks. Measure, don't guess.

### PR-015 — Cadence & Mobile Refinement
- **Goal:** Tighten the coach's rhythm and the workout screen on real phones.
- **Outcome:** Coaching cadence refinement (time anchors, reinforcement, memory),
  a consistent mobile content container, glove-friendly controls, and a dedicated
  workout HUD; P0 beta blockers (resume workflow) fixed.
- **Decision:** Refinements are UI/policy only — the Engine, runtimes, and hooks stay
  untouched. Coaching variety stays deterministic (rotation + memory, never RNG).

### PR-016 — Speech Cancellation Forensics
- **Goal:** Find who cancels the utterance before `onstart`.
- **Outcome:** A complete cancel/dispose call graph, `console.trace` at every cancel
  site, and the finding that four origins funnel through one chokepoint
  (`SpeechService.cancel → synth.cancel`), with `cancelBeforeOnstart=true` during a
  StrictMode-driven disposal.
- **Decision:** There was **no single owner** of speech cancellation — the structural
  defect. Evidence over speculation: let the call graph answer the question.

### PR-017 / 017A / 018 — Activation, Sandbox & Context Comparison
- **Goal:** Rule the browser and the app's own invocation in or out.
- **Outcome:** User-activation instrumentation; an isolated, zero-dependency
  **Browser Speech Sandbox** at `/dev/speech` (later a full engine validator with a
  test matrix); and a side-by-side execution-context comparison of sandbox vs. live
  workout. The sandbox exonerated the browser engine; the comparison isolated one
  meaningful difference — where `speak()` is invoked in the lifecycle.
- **Decision:** Prove claims with an **isolated reproduction**, not theory. When the
  premise (git bisect) couldn't answer the question, say so with evidence instead of
  performing it.

### PR-018B / fix — StrictMode Disposal Root Cause & Resolution
- **Goal:** Prove why `speechSynthesis.cancel()` fires before `onstart`, then fix it.
- **Outcome:** A lifecycle report pinning React StrictMode's `doubleInvokeEffectsInDEV`
  running the `useCoachedWorkout` cleanup between the first runtime's speak and the
  rebuilt runtime — disposal cancelling the shared global. **Fix (option 1):** an
  instance-local `SpeechService.dispose()` that never calls the global
  `speechSynthesis.cancel()`; `cancel()` (quit, barge-in, disable) still does.
- **Decision:** **Explicit ownership** — a per-instance teardown must not mutate a
  shared global. Disposal is instance-local; the shared engine is left to finish.

---

## Documentation

### PR-019 — Documentation Refresh & Architecture Snapshot
- **Goal:** Make the repository accurately reflect the platform as built before the
  next feature track.
- **Outcome:** Refreshed README, ROADMAP, CONTRIBUTING, and decision log; a canonical
  [ARCHITECTURE.md](ARCHITECTURE.md) snapshot; and new records —
  [ENGINEERING_JOURNEY.md](ENGINEERING_JOURNEY.md), [BETA_READY.md](BETA_READY.md),
  and [ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md).
- **Decision:** Documentation is part of "done." The principles that emerged are
  written down to guide future contributors — the coaching pipeline is operational
  end-to-end, and the next track starts from an honest snapshot.
