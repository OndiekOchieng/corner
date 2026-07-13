# STATE_MACHINE.md — Workout Engine Finite State Machine

Companion to `ADR-0001`. Defines the states, the orthogonal run status, the full transition table, guards, side effects, and invalid transitions. This is the normative source for engine behaviour.

---

## 1. Model overview

The engine is a **hierarchical state machine** with two orthogonal dimensions:

- **`phase`** — where we are in the workout: `idle · warmup · round · rest · finished`
- **`status`** — whether the clock is advancing: `running · paused`

`status` is meaningful only in the timed phases (`warmup · round · rest`). Modelling pause as an orthogonal status rather than a first-class `paused` *phase* is a deliberate decision (see §6): a `PAUSED` phase per timed phase would triple the transition table and duplicate every guard.

Cancellation is modelled as an **event** (`CANCEL`) that returns the machine to `idle` and emits `WORKOUT_CANCELLED`, rather than as a distinct terminal phase.

### Extended state (context)

The FSM carries this context (owned exclusively by the engine):

```
WorkoutState = {
  phase:        'idle' | 'warmup' | 'round' | 'rest' | 'finished'
  status:       'running' | 'paused'
  roundIndex:   number            // 0-based; -1 in idle/warmup
  startedAt:    number | null     // clock value at START (anchor for elapsed)
  elapsedMs:    number            // derived each tick; excludes paused time
  pausedAccumMs:number            // total paused time so far this session
  pausedAt:     number | null     // clock value when paused, else null
  cursorMs:     number            // highest elapsed already reconciled (marker cursor)
}
```

Everything a consumer needs is *derived* from this context plus the immutable `Timeline` (see `ENGINE.md`). Consumers never mutate it.

---

## 2. States

| Phase | Timed? | Meaning | Entry side effects (events) |
|---|---|---|---|
| `idle` | no | No workout running (initial + post-cancel). | — |
| `warmup` | yes | Optional lead-in before round 1 (present iff `config.warmupMs > 0`). | `WARMUP_STARTED` |
| `round` | yes | An active work round `roundIndex`. | `ROUND_STARTED` |
| `rest` | yes | Recovery between rounds (never after the final round). | `REST_STARTED` |
| `finished` | no | Terminal success. Session summary is final. | `WORKOUT_COMPLETED` |

`status` values: `running` (clock advances) and `paused` (clock frozen; `elapsedMs` holds).

---

## 3. Events (inputs to the FSM)

Two kinds of inputs drive transitions:

- **Commands** (from consumers/UI): `START`, `PAUSE`, `RESUME`, `SKIP`, `CANCEL`.
- **Time** (from the host's animation loop): `TICK(now)` — the only input that advances `elapsedMs` and triggers *time-based* transitions when the cursor crosses a segment boundary.

`TICK` is idempotent with respect to state: ticking with the same `now` twice changes nothing. This is what makes duplicate/late frames harmless — the defect class behind audit P0-4.

> Note: the *domain events* in `EVENT_MODEL.md` (e.g. `ROUND_STARTED`) are **outputs** emitted as transition side effects. Do not confuse them with the FSM's command inputs.

---

## 4. Transition table

`✓` = allowed, `—` = ignored (no-op, not an error), `✗` = invalid (guarded; logged in dev). Time-driven transitions (via `TICK`) are listed separately below.

### 4.1 Command transitions

| From (phase / status) | START | PAUSE | RESUME | SKIP | CANCEL |
|---|---|---|---|---|---|
| `idle` | → `warmup`* or `round 0` (running) | — | — | — | — |
| `warmup` / running | — | → `warmup` / paused | — | → end warmup (advance to `round 0`) | → `idle` |
| `warmup` / paused | — | — | → `warmup` / running | → `round 0` (running) | → `idle` |
| `round` / running | — | → `round` / paused | — | → complete round (→ `rest` or `finished`) | → `idle` |
| `round` / paused | — | — | → `round` / running | → complete round (→ `rest`/`finished`) | → `idle` |
| `rest` / running | — | → `rest` / paused | — | → complete rest (→ next `round`) | → `idle` |
| `rest` / paused | — | — | → `rest` / running | → next `round` (running) | → `idle` |
| `finished` | → `warmup`*/`round 0` (restart) | — | — | — | → `idle` |

\* `START`/`SKIP` from `warmup` resolve to `warmup` only when `config.warmupMs > 0`; otherwise straight to `round 0`.

### 4.2 Time-driven transitions (`TICK` crossing a segment boundary)

Only fire while `status = running`. When `elapsedMs` crosses a segment's `endMs`:

| Current phase | Boundary crossed | Next phase | Guard | Emitted events (in order) |
|---|---|---|---|---|
| `warmup` | warmup end | `round 0` | — | `WARMUP_COMPLETED?`, `ROUND_STARTED(0)` |
| `round i` | round end | `rest i` | `i < lastRoundIndex` | `ROUND_COMPLETED(i)`, `REST_STARTED(i)` |
| `round i` | round end | `finished` | `i == lastRoundIndex` | `ROUND_COMPLETED(i)`, `WORKOUT_COMPLETED` |
| `rest i` | rest end | `round i+1` | always (rest only exists when a next round exists) | `REST_COMPLETED(i)`, `ROUND_STARTED(i+1)` |

If a single `TICK` crosses **multiple** boundaries (background gap), the engine applies them **in order** until `elapsedMs` lands inside the current segment or reaches `finished` (see §5, fast-forward).

### 4.3 Guards

- **G1 — START only from `idle`/`finished`.** `START` elsewhere is ignored (`—`), never throws.
- **G2 — PAUSE only when `running` and phase is timed.** No-op otherwise.
- **G3 — RESUME only when `paused`.** No-op otherwise.
- **G4 — Monotonic clock.** `TICK(now)` with `now < lastNow` is clamped (treated as `lastNow`); the clock never moves backward. Protects against `performance.now()` anomalies.
- **G5 — Terminal integrity.** No time-driven transition leaves `finished`; only `START` (restart) or `CANCEL` do.
- **G6 — Rest existence.** A `rest` segment is compiled **only** between two rounds, so `rest → finished` can never occur (removes the awkward trailing-rest case PR-001 had to guard in the view).

### 4.4 Invalid transitions (explicitly rejected)

These are logic errors; in dev they assert/log, in prod they are ignored to keep the workout resilient:

- `RESUME` while `running`; `PAUSE` while `paused`.
- `TICK`-driven advance while `paused`.
- Any command from `finished` other than `START`/`CANCEL`.
- Entering `rest` after the final round.
- `roundIndex` outside `[0, roundCount)`.

---

## 5. Timekeeping & fast-forward

`elapsedMs` is **derived**, never accumulated:

```
elapsedMs = clamp(now - startedAt - pausedAccumMs, 0, timeline.totalMs)   // while running
elapsedMs = (frozen value)                                                // while paused
```

On each `TICK` the engine **reconciles** from `cursorMs` up to the new `elapsedMs`:

1. Emit any **markers** (countdown seconds, coaching cues) with offset in `(cursorMs, elapsedMs]`, subject to the delivery policy (§`EVENT_MODEL.md`): boundaries always emit; real-time markers `drop-if-stale`.
2. Apply any **segment-boundary** transitions crossed, in order (§4.2), each with its side-effect events.
3. Advance `cursorMs = elapsedMs`.

**Fast-forward example (phone locked 5 min mid-round-2 of a 3×3 workout):** on unlock, one `TICK` computes a large `elapsedMs`. Reconciliation walks: finish round 2 → (rest 2 fully elapsed) → round 3 → round 3 fully elapsed → `finished`, emitting `ROUND_COMPLETED(1)`, `REST_STARTED(1)`, `REST_COMPLETED(1)`, `ROUND_STARTED(2)`, `ROUND_COMPLETED(2)`, `WORKOUT_COMPLETED` in order. Countdown/cue markers crossed during the gap are **dropped as stale**. Result: the machine lands in the correct terminal state and the coach says "Workout complete." — not a 5-minute replay. This is the determinism guarantee.

---

## 6. Why pause is a status, not a phase (analysis)

The prompt asks whether `Paused` should be an explicit state. Options weighed:

- **(a) `PAUSED` as a phase** that remembers the interrupted phase. Cost: every timed phase needs `→ PAUSED` and `PAUSED → back`; guards duplicate; the "which phase were we in" data has to live somewhere anyway. Transition table roughly triples.
- **(b) `status` orthogonal to `phase` (recommended).** Pause/resume are two transitions total, valid uniformly across timed phases; the interrupted phase is simply the unchanged `phase`; paused time is accounted in `pausedAccumMs`. Cleanest, fewest guards, matches the derived-time model exactly.

**Decision: (b).** It yields the smallest correct table and keeps `elapsedMs` honest. A `paused`-looking state is still trivially derivable for the UI as `status === 'paused'`.

---

## 7. Diagram

```
        START (G1)
  ┌───────────────────────────┐
  ▼                           │
┌──────┐  warmupMs>0   ┌─────────┐  end   ┌─────────┐  end (i<last) ┌────────┐
│ idle │ ────────────▶ │ warmup  │ ─────▶ │ round i │ ────────────▶ │ rest i │
└──────┘               └─────────┘        └─────────┘               └────────┘
  ▲  ▲   warmupMs==0        │  ▲               │  ▲   end (i==last)     │
  │  └─────────────────────────────────────────┘  │                     │ end
  │                                                └─────────────────────┘
  │                                              (rest i → round i+1)
  │                          end (i==last)
  │                    ┌──────────────────┐
  │  CANCEL (any)      ▼                  │
  └───────────────  ┌──────────┐          │
                    │ finished │◀─────────┘
                    └──────────┘
                         │ START (restart)
                         └────────▶ (idle-equivalent re-entry)

  status overlay (any timed phase):  running ⇄ paused   via PAUSE / RESUME
```

---

## 8. Determinism contract (testable invariants)

For any workout config and any sequence of `TICK`/command inputs:

1. **No duplicate lifecycle events.** `ROUND_STARTED(i)` and `WORKOUT_COMPLETED` each fire at most once per session.
2. **Count correctness.** Exactly `roundCount` `ROUND_STARTED` and `ROUND_COMPLETED` events occur in a completed session.
3. **Monotonic ordering.** For `i < j`, `ROUND_STARTED(i)` precedes `ROUND_STARTED(j)`; every `ROUND_COMPLETED(i)` precedes `REST_STARTED(i)` (when present).
4. **Pause conservation.** `actualDurationMs − pausedAccumMs == plannedDurationMs` for a completed, un-skipped session (within one tick's tolerance).
5. **Idempotent ticks.** `TICK(t)` followed by `TICK(t)` emits nothing on the second call.
6. **Terminal stability.** No input except `START`/`CANCEL` mutates `finished`.

These map directly to the test matrix in `IMPLEMENTATION_PLAN.md`.
