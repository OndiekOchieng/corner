# Platform Stability Review — Runtime Stack (Engine · Host · Runtime · Session)

- **Scope:** the four `src/lib/*` packages built across PR-003, PR-004a/b/c, viewed as one platform.
- **Mandate:** find architectural inconsistencies, duplicated responsibilities, naming issues, and boundary violations introduced during implementation. Propose only cohesion-improving changes. **No features, no rewrites of working code.**
- **Method:** static read + targeted greps of the actual source (evidence cited inline).

---

## 0. Verdict

**The platform is structurally sound.** The dependency graph is acyclic and points the right way (`session → runtime → engine`; `host → runtime, engine`); the engine remained dependency-free and untouched through three subsequent PRs; no upward/boundary *dependency* violations exist (`grep`: runtime does not import host; nothing upstream imports session). Determinism, isolation, and the "engine is unaware of everything above it" invariant all hold.

What accumulated across four PRs is the normal residue of incremental delivery: **a few duplicated primitives, one piece of orphaned dead code sitting in the wrong layer, one app-coupling that leaked into an otherwise-generic package, and some overloaded naming.** None affects behaviour. All fixes are deletions, moves, or extractions — no logic changes. Total effort is small.

Findings are grouped by category; the prioritized refactoring list is in §6.

---

## 1. Duplicated responsibilities

### F1 — `NowFn` type defined twice; `defaultNow()` implemented four times
**Evidence:** `type NowFn` in `runtime/types.ts:10` **and** `session/SessionDiagnostics.ts:14`. Identical `performance.now()/Date.now()` fallback duplicated in `host/HostClock.ts`, `runtime/EventBus.ts`, `session/SessionDiagnostics.ts`, `session/PersistenceSubscriber.ts`.

**Why it hurts cohesion:** "current time" is a platform-wide primitive; four copies drift independently (e.g., one could later add a monotonic guard and the others wouldn't). Two exported `NowFn` types invite ambiguous imports.

**Proposed change (no behavior change):** add one tiny, dependency-free `src/lib/shared/time.ts` exporting `NowFn` and `systemNow()`; import it from runtime + session (+ optionally `BrowserClock`). The engine's `Clock`/`SystemClock` stay untouched (engine must remain standalone).

### F2 — Two parallel diagnostics implementations (`RuntimeDiagnostics`, `SessionDiagnostics`)
**Evidence:** both implement the same shape — `record*` methods, capped arrays, injectable `now`, immutable `snapshot()`.

**Assessment:** this duplication was a **deliberate, correct** boundary call (the Event Runtime shouldn't know about checkpoints/migrations; PR-004c §Diagnostics). Keep them separate. The only shared-able bit is a capped-array helper — very low value. **No action recommended** beyond noting it.

---

## 2. Dead / mislayered code

### F3 — Orphaned `SessionStore` interface living inside the engine
**Evidence:** `engine/SessionStore.ts` is exported (`engine/index.ts:88`) and referenced only by a doc comment (`engine/WorkoutSession.ts:8`). Nothing implements or consumes it. PR-004c introduced the real persistence abstraction (`session/StorageAdapter` + `SessionRepository`), which fully supersedes it.

**Why it hurts cohesion (two problems):**
1. **Dead code** — an interface no code implements.
2. **Wrong layer** — it puts a *persistence* concept inside the *engine*, the one package whose defining invariant is "completely unaware that persistence exists." It's a latent contradiction of the platform's core boundary.

**Proposed change (pure deletion, zero behavior risk):** remove `engine/SessionStore.ts`, its export, and update the `WorkoutSession.ts` comment to point at `session/StorageAdapter`. This *strengthens* the engine boundary rather than weakening it.

---

## 3. Boundary drift

### F4 — App-specific coupling inside the generic Event Runtime
**Evidence:** `runtime/subscribers/CoachEngineAdapter.ts:16-18` imports `@/types/workout` and `@/lib/speech/*`. This is the **only** app coupling inside `src/lib/runtime`, which is otherwise reusable, app-agnostic infrastructure (bus, dispatcher, registry, diagnostics, and the generic Logger/Stats/Bell subscribers).

**Why it hurts cohesion:** it blurs the line between "generic event platform" and "Corner-specific integration." As written, you cannot lift `src/lib/runtime` into another product without dragging in the speech stack and the app's `Round` type. The `CoachSubscriber` itself is clean — it depends only on the app-agnostic `Coach` port; it's the **adapter** (the PR-001 bridge) that's app-specific.

**Proposed change (file move, no logic change):** relocate `CoachEngineAdapter` (the PR-001 bridge) to an integration module (e.g., `src/lib/integration/` or alongside the eventual app wiring). Keep `CoachSubscriber` + the `Coach` port in `runtime` (they're generic), or move both together. No consumer wires this yet, so the move is risk-free. Update the barrel export accordingly.

*(Note: this is drift, not a violation — it doesn't create a cycle. But it undermines the "runtime is a reusable layer" story the architecture sells.)*

---

## 4. Naming

### F5 — "Runtime" is overloaded across packages
**Evidence (grep):** `RuntimeLoop` (in the **host** package), `RuntimeDiagnostics` / `RuntimeStats` (in the **event runtime**), `HostRuntime` (host), plus the prose concepts "Event Runtime" and "Session Runtime." The term denotes at least three different things.

**Why it hurts cohesion:** `RuntimeLoop` reads as if it belongs to the "runtime" package but lives in `host`; `RuntimeStats` (the StatsSubscriber's output) is easily confused with `RuntimeDiagnostics`. Newcomers must learn which "runtime" each name means.

**Proposed change (cosmetic; defer unless already editing those files):** `RuntimeLoop → FrameLoop`/`TickLoop`; `RuntimeStats → WorkoutStats`. Public-symbol renames touch exports + tests → moderate churn for a cosmetic gain. **P3 — flag, don't force.**

### F6 — Two phase vocabularies coexist
**Evidence:** legacy `WorkoutPhase` enum (`types/workout.ts:38`, `ROUND_ACTIVE`, upper snake) vs new engine `Phase` union (`engine/State.ts:14`, `'round'`, lower). Both live in the platform.

**Assessment:** not a defect — they're in disjoint code paths (the new engine isn't wired to the UI yet). But it's a latent inconsistency: when the UI adopts the new engine, a mapping/retirement is required. **Documentation, not code:** declare the engine `Phase` union the single source of truth and mark the legacy enum for retirement when `hooks/useWorkoutEngine.ts` is replaced. No change in this pass.

---

## 5. Minor / no-action

- **F7 — Test affordance on a production type.** `InMemoryStorageAdapter.saveCount` (`session/StorageAdapter.ts:25,33`) exists only for test assertions. It's on the in-memory (test/SSR) adapter, so impact is negligible; optionally move counting to a test-only `CountingStorageAdapter`. **P3.**
- **F8 — `Clock` (object) vs `NowFn` (function).** Two shapes for "time": engine uses `Clock { now() }`, runtime/session use bare `NowFn`. Harmless; unifying would ripple into the engine (which should stay as-is). Fold `NowFn` into the shared util (F1) and leave `Clock` alone. **P3.**
- **F9 — Session data taxonomy.** `WorkoutSession` (engine, objective) → `SessionRecord` (persisted, + subjective rating/notes) → `SessionSummary` (promoted stats), plus the `SessionSnapshot` alias. These are *distinct purposes*, not duplication — but the naming similarity warrants a one-paragraph taxonomy note in `ENGINE.md`/`session` docs. **P3, doc-only.**
- **F10 — Lifecycle event-set defined in two places.** `PersistenceSubscriber.LIFECYCLE` and the test `LIFECYCLE_TYPES`. Prod/test duplication, immaterial. **No action.**

---

## 6. Prioritized refactoring list

All items are behaviour-preserving. "Risk" is the chance of breaking a test/consumer.

| # | Priority | Change | Files | Effort | Risk |
|---|---|---|---|---|---|
| R1 | **P1** | Delete orphaned `SessionStore` (F3); update the referencing comment. Strengthens the engine boundary. | `engine/SessionStore.ts` (del), `engine/index.ts`, `engine/WorkoutSession.ts` | XS | None (nothing uses it) |
| R2 | **P1** | Extract one `shared/time.ts` (`NowFn` + `systemNow`); replace the 4 `defaultNow` copies and the 2nd `NowFn` (F1, F8). | new `shared/time.ts`; `runtime/*`, `session/*`, `host/HostClock.ts` | S | Low (mechanical) |
| R3 | **P2** | Move `CoachEngineAdapter` out of generic `runtime` into an integration module (F4); keep `CoachSubscriber`/`Coach` port generic. | `runtime/subscribers/CoachEngineAdapter.ts` → `integration/`, barrel + test imports | S | Low (no live consumer) |
| R4 | P3 | Disambiguate "Runtime" names: `RuntimeLoop→FrameLoop`, `RuntimeStats→WorkoutStats` (F5). | `host/RuntimeLoop.ts`, `runtime/subscribers/StatsSubscriber.ts`, exports, tests | M | Low but broad churn |
| R5 | P3 | Doc-only: declare engine `Phase` the single phase vocabulary; mark legacy `WorkoutPhase` for retirement (F6). | `ENGINE.md` / this doc | XS | None |
| R6 | P3 | Move `saveCount` to a test-only counting adapter (F7). | `session/StorageAdapter.ts`, test helpers | XS | None |

### Recommended action now
Do **R1 + R2** (both P1, both trivial, both remove real debt with zero behaviour risk) and **R3** (P2, restores the reusable-runtime boundary while no consumer is affected). Defer R4–R6 until someone is already editing those files — the churn isn't justified on its own, and forcing renames now risks noise without cohesion payoff.

### What NOT to change
- The engine, and its dependency-free standalone-ness — leave it exactly as is.
- The two separate diagnostics classes (F2) — the separation is correct.
- The `WorkoutSession`/`SessionRecord`/`SessionSummary` split (F9) — distinct responsibilities, not duplication.
- Any working control flow in the reducer, host loop, dispatcher, or persistence paths — this review found no correctness or cohesion reason to touch them.
