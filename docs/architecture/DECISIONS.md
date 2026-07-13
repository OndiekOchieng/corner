# Architecture Decision Log

A running record of Architecture Review Board (ARB) decisions. Newest first. Each entry is the durable record; the linked ADRs hold the full reasoning.

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
