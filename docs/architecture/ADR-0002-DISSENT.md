# ADR-0002 — Dissent to the Architecture Review Board

- **Author role:** Dissenting reviewer, ARB
- **Position:** **Reject ADR-0002 as proposed. Do not adopt the input-log / Terminator / event-sourced core now.** Ship the smallest fixed-duration engine (ADR-0001, trimmed) plus three cheap amendments, and revisit adaptivity when the first adaptive feature is actually greenlit and specified.
- **Scope of dissent:** the *timing and scope* of ADR-0002, not the intelligence of its ideas.

---

## 0. What ADR-0002 gets right (so this dissent is credible)

- The **(D1) vs (D2)** distinction is a genuine insight and worth keeping.
- "A fixed workout is a special case of an adaptive one" is true and elegant.
- Acknowledging phasing (types now, runtime later) shows discipline.

None of that is in dispute. The dispute is: **should we adopt a general adaptive-execution platform — with an append-only canonical input log, a Terminator union, a signal abstraction, and event-sourced replay/transport — for a product that has not yet shipped a reliable timer, to serve features that are 3–5 years out and whose real requirements we cannot yet know?** My answer is no, and I think the board should say no too.

---

## 1. This is premature abstraction — the textbook case

The product today is **fixed-duration boxing rounds.** The features ADR-0002 exists to enable — HR-gated rest, punch-count termination, real-time AI retiming — are the *last* items on the roadmap, not the next. ADR-0002 is designing the API for consumers **that do not exist**, against requirements **we are guessing at**.

Concretely, we cannot yet answer the questions that should drive that API:
- **HR termination:** hysteresis band? what happens on sensor dropout mid-rest? a hard safety cap always, or optional? per-user resting-HR calibration? These are the *actual* design; `{ kind: 'signal'; predicateId }` is a guess that will be redesigned when we know them.
- **Punch counting:** debounce thresholds, false-positive handling, "combo" semantics — none knowable now.
- **AI Coach:** the industry norm is content generation and post-session analysis, **not** real-time mutation of a running state machine. `RESHAPE` may serve a feature that never ships in that form.

Sandi Metz's rule applies: **"duplication is far cheaper than the wrong abstraction."** A `Terminator` union that unifies `duration` (a number), `signal` (a stateful, failure-prone sensor stream), and `command` (a user gesture) under one `anyOf` is unifying three things with utterly different lifecycles and error modes. That unification is far more likely to be *wrong* than *reused* — and un-picking a wrong core abstraction is exactly the rewrite this track claims to prevent.

**Rule of three:** abstract on the third real occurrence, not the zeroth imagined one. We have zero adaptive features in production.

---

## 2. Event sourcing is a heavyweight platform decision made pre-PMF

Making the append-only `InputLog` **canonical** (state is a projection you must `reduce()` to see) is event sourcing. Its costs are real and **permanent**:

- Log growth → compaction, snapshotting, truncation policy.
- **Every input type is now a persisted schema, versioned forever.**
- Reducer purity becomes load-bearing: **no `Date.now`, no `Math.random`, no I/O** — and this codebase violates that casually today (localStorage writes `new Date()` into custom workouts; the audit flagged it). One impure reducer and replay silently diverges.
- Debugging indirection: you can't read state; you fold a log to get it.
- A materially higher barrier to contribution on a small team.

We are adopting a distributed-systems substrate for an app whose **headline feature was completely dead until PR-001** and which **still cannot keep the screen awake (M2 unresolved).** That is inverted priority. Event sourcing is a "100k users, audit/replay is a requirement" solution; we are pre-product-market-fit.

---

## 3. The determinism argument is a bait-and-switch

ADR-0002 sells the expensive thing (persisted canonical log + replay-from-seq) using the virtues of the cheap thing (a pure reducer). But **(D2) "same inputs → same output" is a property of *any* pure reducer** — including ADR-0001's `reducer.ts` — and requires **neither persistence nor a canonical log nor replay transport.**

You get full determinism, FakeClock testability, and `replay(actions) === replay(actions)` from an in-memory `(state, action) => state` reducer that you **throw away** after each tick. The testability win is already in ADR-0001. Bundling it with event sourcing and citing the shared word "reduce" to justify the whole platform is rhetorical, not architectural. **Keep the pure reducer; drop the canonical/persisted/replayable log.**

---

## 4. The concrete features don't actually need this model

- **AMRAP / user-paced:** the FSM in `STATE_MACHINE.md` **already has `SKIP`**. "Round until the user taps next" is a long-duration segment plus `SKIP`. The `command` Terminator is redundant with a command that already exists. This claimed motivator evaporates on inspection.
- **HR-gated rest:** genuinely new — but it is **one** feature, arriving alone, and when it does it wants a **narrow** mechanism designed around real sensor behaviour, not a pre-baked union. Adding a focused `signalTerminator` for exactly that case then is cheaper than carrying the general model for years.
- **Real-time AI retiming:** speculative; possibly never real in that form. Designing `RESHAPE` for it now is designing for a hypothesis.

When a proposal's stated motivators are (a) already handled, (b) singular-and-future, and (c) speculative, the model they justify is not yet warranted.

---

## 5. "Typed but inert extension points" is a trap, not a hedge

The phasing plan — ship `signal`/`command`/`RESHAPE` as typed-but-inert now — sounds cheap but is not:

- **Inert code rots.** Unused, effectively-untested paths drift from reality and give false confidence ("we already support signals!" — we don't).
- **You pay twice.** You build the speculative shape now, then refactor it when the real requirements land, because they will differ.
- **It taxes everything in between.** Every reducer signature, every event payload, every test, every new contributor's mental model now carries adaptive machinery that no shipping feature uses.

"Types now" honestly means "design the types when the feature is real." The cheapest inert code is the code you didn't write.

---

## 6. One mechanism solving four unrelated problems is a smell, not a win

ADR-0002 markets that the input log "unifies M1 (adaptivity), M3 (sync), M4 (recovery), and Alt-A." That is precisely the warning sign of an over-general hammer. It also **couples** them: you can no longer ship *simple crash recovery* without buying the *entire adaptive/event-sourced core*. These problems have independent, far cheaper point solutions (§8). Coupling a 30-line resume feature to a platform migration is how scope metastasizes.

---

## 7. Opportunity cost against the *actual* next 24 months

Every hour on Terminators and input logs is an hour not spent on what the roadmap actually needs next, all of which is **fixed-duration**:

| Next 24 months (per ROADMAP / ADRs) | Needs adaptive execution? |
|---|---|
| Deterministic engine + reliable phase completion | No |
| **Wake lock / background audio (M2 — the real blocker)** | No |
| Session persistence + History | No |
| Custom workouts + Workout Builder | No |
| First-class warmup | No |

Not one 24-month item requires conditional termination. Meanwhile **M2 — the reason the coach goes silent when the phone is face-down — is punted to ADR-0003.** Adopting a bigger core model before proving the engine can even run in the background is building the second storey before pouring the foundation. Worse: if ADR-0003 lands the engine in a Web Worker with an audio clock, those constraints may reshape the core anyway — so locking in the event-sourced core now risks **reworking it after M2**.

---

## 8. The smallest architecture that satisfies the next 24 months

Reject ADR-0002. Adopt **ADR-0001, trimmed, plus three cheap amendments** — total new concepts: **zero**.

1. **Pure reducer over a fixed, precompiled timeline** (already in ADR-0001). Absolute offsets, O(log n), fully inspectable. Determinism (D1 *and* D2) come free because the reducer is pure. Ticks are actions; FakeClock drives tests. **No persisted log, no replay substrate.**

2. **Crash recovery & resume (M4) via checkpointing — ~30 lines.** On each lifecycle event, write a tiny `SessionSnapshot` (`workoutId, elapsedMs, roundIndex, status, startedAtWall`) to localStorage. On relaunch: if non-terminal, offer **Resume** by seeking the engine to `elapsedMs`; else mark `abandoned` and persist to History. This delivers recovery, resume, and History **without** event sourcing.

3. **Schema versioning on persisted/transported types — the one genuinely cheap-now/expensive-later item.** Add `schemaVersion` to `SessionSnapshot`, `WorkoutConfig`, and preferences. Adopt *this* part of the review (M3's versioning) **without** adopting the log.

**Sync & wearables, when they are real:** sync the **result** (`SessionSnapshot`) and the **definition** (`WorkoutConfig`) as versioned DTOs — both tiny. A Watch showing "Round 2 · 1:34" consumes the **state-snapshot channel ADR-0001 already defines**; it does not need an event log. Build the transport in ADR-0004 against the *actual* feature.

**Adaptivity, when it is real:** introduce a narrow terminator/predicate for the *specific* first adaptive feature (likely HR), designed around real sensor constraints, on the rule of three. If AMRAP comes first, it's `SKIP` — nothing to build.

This satisfies 100% of the 24-month roadmap, closes M4 and M3-versioning cheaply, keeps the core inspectable and contributor-friendly, and **preserves every option** ADR-0002 wants — because a pure reducer over a fixed timeline is a clean starting point from which to grow a Terminator model *later*, informed by reality.

---

## 9. What would change my mind (I am not being dogmatic)

Adopt the ADR-0002 core when **any** of these becomes true — not before:

- **Two or more** adaptive features are greenlit and specified within one horizon (rule of three approaching), so a shared model has real, known consumers.
- A **hard requirement for audit/replay** appears (regulatory, safety, coaching liability) that genuinely needs a canonical event log.
- A **remote real-time consumer** (live-synced Watch during the workout, or multi-device sessions) is committed, making replay-from-seq a concrete need rather than a hypothetical.

At that point ADR-0002's model is likely the right answer — and it will be *better designed* for having waited, because it will be built against real constraints instead of guesses.

---

## 10. Recommendation to the board

1. **Do not adopt ADR-0002 now.** Mark it **Deferred**, not rejected — its ideas are sound; its timing is wrong.
2. **Approve the trimmed ADR-0001 + §8 amendments** as the engine to build in PR-003/PR-004.
3. **Prioritise ADR-0003 (M2 — background tick source) ahead of any adaptivity work**, because it blocks the core product experience today and may constrain the engine anyway.
4. **Re-open ADR-0002 when a §9 trigger fires.** Keep it on the shelf, not in the build.

The strongest version of "supporting the next five years without a rewrite" is not building the five-year platform now. It is shipping a small, correct, honest core, keeping it pure and inspectable, and **earning** each abstraction when a real feature pays for it. Speculative generality is how you *guarantee* the rewrite — you just do it twice.
