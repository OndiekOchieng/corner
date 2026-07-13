# PR-012 — Session Persistence Verification & History Wiring

The Session Runtime already existed and was fully tested; it was simply never
connected to the live app. This PR verifies the pipeline and completes the wiring
so a completed workout is persisted to LocalStorage and appears immediately in
History. No second persistence mechanism was introduced.

---

## Root cause

The pipeline was severed in two places, plus two behaviour gaps:

1. **The `PersistenceSubscriber` was never registered.** `useCoachedWorkout`
   built the Host Runtime with `subscribers: [coach, media]` only — so
   `WORKOUT_COMPLETED` never reached persistence and nothing was ever written.
2. **The History screen rendered placeholder data** (a static empty state) instead
   of reading `SessionRepository`.
3. **Cancel entered history.** `PersistenceSubscriber.handle` routed both
   `WORKOUT_COMPLETED` and `WORKOUT_CANCELLED` to `finalize()` (append to history) —
   contradicting "cancel does not enter history."
4. **Coach wasn't persisted**, so History couldn't show it.

## The pipeline, verified

```
Workout → Engine → Event Runtime → PersistenceSubscriber → SessionRepository
        → LocalStorageAdapter → LocalStorage → HistoryService → History screen
```

- **Registered** — `useCoachedWorkout` now registers a `PersistenceSubscriber`
  on `runtime.eventBus` before `start()`, so it sees `WORKOUT_STARTED` and every
  lifecycle event.
- **`WORKOUT_COMPLETED` reaches it** — verified end-to-end in
  `history-wiring.test.ts` (engine → bus → subscriber → repository → history).
- **Checkpointing** — `WORKOUT_STARTED/PAUSED/RESUMED` force a checkpoint of the
  active slot (debounced ≤1/s on the progress path); unchanged.
- **Completed → history** — `finalize()` appends to history and clears the active
  slot. **Cancelled → discarded** — a new `discard()` clears the active slot and
  does NOT append to history.
- **History reads the repository** — the screen calls
  `createHistoryService().listSessions()`.
- **Resume** — the active slot is still checkpointed and cleared on finish, so any
  resume affordance disappears once a workout completes; pause/resume in-workout is
  untouched.

## LocalStorage schema

One canonical format, one backend (`LocalStorageAdapter`), one prefix:

| Key | Meaning |
|---|---|
| `corner:session:active` | the single resumable session (checkpoint); cleared on finish/cancel |
| `corner:session:history:<sessionId>` | one record per completed session |

Each value is a versioned JSON envelope:

```jsonc
{
  "version": 3,
  "record": {
    "session": { /* engine WorkoutSession: id, workoutId, status, roundsCompleted,
                    activeDurationMs, plannedRounds, startedAt, completedAt, … */ },
    "rating": 5 | null,
    "notes": "…" | null,
    "coach": "fightnight" | null,   // added in v3
    "savedAt": 1700000000000        // wall-clock (live now = Date.now)
  }
}
```

**Versioning / migration** (`SessionSerializer`): `PERSISTENCE_SCHEMA_VERSION = 3`,
with `v1 → v2` (adds `notes`) and `v2 → v3` (adds `coach`). Old payloads upgrade one
step at a time on read; migrations are recorded in diagnostics. There is no second
storage path — the workout selection / preferences use unrelated UI keys.

## History verification

The screen shows, per completed session: **Workout** (name resolved from the
workout catalogue by `workoutId`), **Coach** (pack label), **Duration**, **Completed
rounds**, **Completed date** (`savedAt`, wall-clock), and **Rating** (stars, when
set). Sessions are filtered to `completed` and sorted newest-first. The rating is
captured on the finish screen and attached to the already-persisted session via
`HistoryService.rateSession` (which preserves the coach). Cancelled workouts never
appear.

## Files changed

- `src/lib/session/SessionSerializer.ts` — `coach` field; schema `2 → 3` + migration.
- `src/lib/session/SessionRepository.ts` — `coach` + `savedAt` on `SessionSummary`.
- `src/lib/session/PersistenceSubscriber.ts` — `coach` in meta/record; `WORKOUT_CANCELLED` → `discard()` (no history).
- `src/lib/integration/session-store.ts` (new) — canonical `createSessionRepository` / `createHistoryService`.
- `hooks/useCoachedWorkout.ts` — register the `PersistenceSubscriber` (coach meta, `Date.now`); expose `getSessionId`.
- `app/(routes)/workout/[id]/active/page.tsx` — pass `sessionId` to the finish screen.
- `app/(routes)/history/page.tsx` — read `SessionRepository` (was placeholder).
- `components/Finish/FinishScreen.tsx` + `app/(routes)/finish/page.tsx` — persist rating/notes via `rateSession`.
- `lib/constants.ts` — `COACH_LABELS`.
- Tests: `persistence.test.ts` (cancel now discarded), `serialization.test.ts` (coach + v2→v3), `history-wiring.test.ts` (new).

## Regression summary

228 tests pass (5 new), `tsc` clean (one pre-existing unrelated error), production
build succeeds. The engine, event runtime, coach runtime, and media runtime are
untouched; the Session Runtime's public shape is unchanged apart from the additive
`coach`/`savedAt` fields and the corrected cancel semantics.
