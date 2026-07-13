# Architecture Decision Log

A running record of Architecture Review Board (ARB) decisions. Newest first. Each entry is the durable record; the linked ADRs hold the full reasoning.

---

## 2026-07-14 — Speech lifecycle investigation: **RESOLVED**; Coach Runtime operational

**Context.** After the coach reached `speechSynthesis.speak()` but never produced audio on Chrome Android, a multi-stage forensic investigation (PR-014 → PR-018B) traced the failure through the whole speech pipeline. See [`../media-runtime/SPEECH_PIPELINE_TRACE.md`](../media-runtime/SPEECH_PIPELINE_TRACE.md) and [`../ENGINEERING_JOURNEY.md`](../ENGINEERING_JOURNEY.md).

**Decision / findings (Resolved):**
1. **Root cause identified.** React StrictMode's dev double-invocation (`doubleInvokeEffectsInDEV` → `commitHookPassiveUnmountEffects`) ran the `useCoachedWorkout` build-effect cleanup *between* the first runtime's `controller.start()` (which speaks) and the rebuilt runtime — and `SpeechService.cancel()` cancelled the **shared global** `window.speechSynthesis`, aborting the in-flight utterance before `onstart` (`error="canceled"`, `cancelBeforeOnstart=true`).
2. **StrictMode disposal issue resolved.** Fix (option 1): `SpeechService.dispose()` is now **instance-local** and never calls the global `speechSynthesis.cancel()`; `SpeechManager.dispose()` prefers `engine.dispose()`. Explicit `cancel()` (quit / barge-in / disable) still cancels the global, as intended. Committed with a regression test; 237 tests green.
3. **Browser speech pipeline verified.** An isolated, zero-Corner-dependency **Browser Speech Sandbox** (`/dev/speech`, dev-only) validated the native Web Speech engine independently, exonerating the app layer and confirming the boundary.
4. **Coach Runtime operational end-to-end.** A real workout is coached out loud through the full stack (Engine → Host → Event → Coach → Media), with bells, wake lock, and graceful degradation.

**Principle reinforced:** *explicit ownership* — a per-instance teardown must never mutate a shared global (`window.speechSynthesis`). Recorded in [`../ARCHITECTURE_PRINCIPLES.md`](../ARCHITECTURE_PRINCIPLES.md) (§7).

**Known future work (not blocking this decision):**
- **On-device confirmation of the production path.** The disposal defect is dev/StrictMode-only; production (no double-invoke) must still be confirmed audible on real iOS Safari and Chrome Android. Tracked in [`../BETA_READY.md`](../BETA_READY.md).
- **ADR-0003 — background tick source** (screen-off / lock-screen audio continuity) remains **open** and is the next real platform blocker.

---

## 2026-07-12 — ADR-0002 (Adaptive vs Deterministic Execution): **DEFERRED**

**Decision.** ADR-0002 is **deferred, not rejected**. **ADR-0001 remains the baseline architecture**, amended (below). The adaptive execution model is technically sound but introduces architectural complexity not required to satisfy the currently committed product roadmap.

**Inputs to the decision:**
- `ADR-0002-adaptive-vs-deterministic-execution.md` — the proposal (adopt).
- `ADR-0002-DISSENT.md` — the counter-argument (defer).
- `ARCHITECTURE_REVIEW.md` — the Principal review that raised the fork (Q1) and findings M1–M4, S1–S8.

**Required amendments to ADR-0001** (binding on PR-003/PR-004, see `ADR-0001` §9):
1. **First-class `WorkoutSession`** — session identity + lifecycle + durable checkpointing, owned by a `SessionStore`; delivers crash recovery, resume, and correct finish stats (closes review M4 and audit P0-2) **without** event sourcing.
2. **Schema versioning** — explicit `schemaVersion` on every persisted/transported model (`WorkoutSession`, `WorkoutConfig`, `UserPreferences`, custom workouts); adopts the review's M3-versioning finding standalone.
3. **Explicit (inert) extension points** — named seams for future adaptive terminators (a one-member discriminated union for segment `end`; a reducer input type positioned to grow). Seams only — **no** runtime, per the dissent's premature-abstraction guard.

**Explicitly not adopted:** append-only canonical input log, event-sourced core, replay-from-seq transport, `Terminator`/`Signal`/`RESHAPE` runtime. Determinism contract stays **(D1) fixed-timeline**.

**Reconsideration triggers** (re-open ADR-0002 when any is true):
- A committed adaptive-execution capability (HR-gated segment, punch-count termination, AMRAP beyond `SKIP`, real-time AI retiming); **or**
- Replay / event-sourcing becomes necessary for a concrete feature — cloud sync of in-progress or multi-device live sessions, or regulatory/audit replay.

**Follow-on decisions unblocked and prioritised:**
- **ADR-0003 — Background tick source (review M2).** The real production blocker (screen-off = silent coach). **Prioritised ahead of any adaptive work.**
- **ADR-0004 — Sync & transport (review M3 delivery).** Deferred until sync is a committed feature.

**Status of related docs after this decision:**
| Doc | Status |
|---|---|
| `ADR-0001` + `ENGINE/STATE_MACHINE/EVENT_MODEL/IMPLEMENTATION_PLAN` | **Accepted baseline**, with §9 amendments |
| `ADR-0002` (+ `DISSENT`) | **Deferred**, on the shelf |
| `ADR-0003` (background tick source) | **Open — next** |
| `ADR-0004` (sync & transport) | Open — deferred |
