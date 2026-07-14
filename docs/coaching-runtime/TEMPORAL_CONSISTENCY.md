# Temporal Coaching Consistency (PR-021)

The coach must always speak about **now**. Speech is not a recording — it is a live
interpretation of the workout timeline. If a coaching moment has passed, discard it;
never replay history, never introduce a round twice, never begin a line that the
countdown is about to cut off.

> The athlete should never think *"the coach is catching up."* The coach should feel
> present, aware, and synchronized with the workout.

Implemented entirely in the Coach Runtime (the resume fix uses the existing
`SpeechSink`, so the Media Runtime needed no change). No Engine, Host, Event, or
Session Runtime changes. Related: [../coaching/COACHING_MEMORY.md](../coaching/COACHING_MEMORY.md) ·
[SESSION_INTRODUCTIONS.md](SESSION_INTRODUCTIONS.md).

---

## 1. Session vs. Round ownership

The two openings had overlapping responsibilities — the intro's hand-off announced the
round and even repeated a round-opening instruction. They are now cleanly separated:

| Owner | Says | Never says |
|---|---|---|
| **Session Introduction** (`WORKOUT_STARTED`) | welcome · the workout · today's objective · a hand-off ("Let's get to work.") | "Round one", a round objective, or a round-opening instruction |
| **Round Introduction** (`ROUND_STARTED`) | the round number · the round objective · the opening instruction | anything the session already framed |

The intro's `transition` banks were rewritten to hand off without naming the round.
Before: *"Round one. Let me see those hands."* → after: *"Let's go to work."* The round
is announced exactly once, by `ROUND_STARTED`.

```
WORKOUT_STARTED   Session Introduction ── "…today's focus is distance control. Let's get to work."
      │
ROUND_STARTED     Round Introduction   ── "Round 1. Stance & Footwork. Let me see those hands."
```

## 2. Temporal validity (the expiry policy)

Every `CoachAction` carries a validity deadline (`expiresElapsedMs = createdElapsedMs +
ttl`, in engine `elapsedMs`). A line that could not be spoken within its window is
**stale** and is dropped by the queue rather than replayed.

| Intent | TTL | Rationale |
|---|---|---|
| `workout_intro` | 8 s | the welcome is only relevant at the very start |
| `round_intro` | 20 s | belongs at the top of the round, not later |
| `time_anchor` | 6 s | "one minute to go" is wrong ten seconds later |
| instruction / reminder / correction / combination / reinforcement | 12 s | a cue that missed its moment is stale |
| `urgency` | 2.5 s | the final push is worthless late |
| `countdown` / `finish` | ∞ (`null`) | the trust skeleton is always valid when it fires |

`VALIDITY_TTL_MS` in `CoachAction.ts`; the queue's `expire(nowMs)` discards anything past
its deadline on every drain.

## 3. Queue lifecycle

```
enqueue ─▶ [ future coaching, ordered by priority ]
   │            │
   │         expire(now)  ── drop anything past its validity deadline
   │            │
   ▼         drain(now) ── render valid actions in priority order; a critical
 overflow                  action that outranks the current line interrupts it
 (drop lowest)
   │
 flush() ── drop everything (resume / cancel)
```

The queue represents **future** coaching. Actions may expire; actions may be discarded.
That is correct behaviour — the workout timeline always wins.

## 4. Resume reconciliation

On `WORKOUT_RESUMED` the coach does **not** blindly resume the old speech. Blind resume
was the bug: a paused intro (or a stale cue) buffered in the speech engine replayed while
the athlete was already seconds into the round.

```
WORKOUT_RESUMED
   │  current elapsed (from the event)
   ├─ flush the coach queue        ── no stale pending actions
   ├─ sink.cancel()                ── drop buffered + mid-utterance stale speech
   └─ sink.resume()                ── un-pause the engine for NOW
        │
        ▼
   the ongoing event stream supplies coaching for the current point
```

Result: resume at 5 s, 45 s, or 90 s all sound like the coach knows exactly where the
athlete is. Nothing from before the pause replays; the next scheduled cue coaches the
current moment.

```
timeline:  ──intro──▶│ round 1 …………………………│
speech:    ──intro──▶│(pause)   ✗ stale intro dropped on resume
resume at 45s:              └─▶ next cue @60s ── "Keep your hands high"  (present, not catching up)
```

## 5. Structural-deadline preemption

Before starting a coaching line, the coach estimates whether it can finish before the
next **countdown beat** — and skips it if not, rather than letting *"Ten… Nine…"* cut it
off mid-word.

- The engine's countdown beats are the fixed thresholds `[10, 5, 4, 3, 2, 1]` seconds
  remaining. The coach mirrors them and computes the **soonest** beat at/after now from
  the round-end deadline (`roundEndsAtMs`, recorded on `ROUND_STARTED`).
- Speech duration is a deterministic estimate of the text (`estimateSpeechMs` ≈ 167 wpm).
- If `now + estimate + buffer > nextBeat`, the (non-structural, non-critical) line is
  **skipped**. Countdown and finish are exempt and always land.

```
round end ─┐
… 30s cue ─┼─ finishes ≪ next beat → SPOKEN
…          │
10s beat ──┤◀── "This is the round — dig!" starts here → would be cut → SKIPPED (not interrupted)
5s beat ───┤
1s beat ───┘
```

This is why the final-round urgency, which lands on the 10 s beat, is now skipped rather
than interrupted — while ordinary mid-round cues that fit between beats still speak.

## 6. Determinism

No wall clock, no randomness. Every validity deadline, every countdown beat, and the
resume reconciliation derive from the engine's `elapsedMs`; the speech-duration estimate
is a pure function of the text. Same workout → same pause time → same resume time → same
output. Verified by test.

## 7. Tests (`src/tests/coaching/temporal.test.ts`)

✓ intro never announces/duplicates Round 1 · ✓ resume after 5 s / 45 s / 90 s never
replays the intro · ✓ resume output identical regardless of resume time · ✓ post-resume
coaching is for the current moment · ✓ expired coaching discarded, still-valid preserved
· ✓ countdown preemption (fits → spoken, collides → skipped) · ✓ no interrupted late
coaching · ✓ pause/resume determinism. Plus the full-workout suite confirming the
final-round push is skipped, not cut. 281 passing; tsc clean; build green.

## Implementation report

- **`personalities.ts`** — all six `introduction.transition` banks rewritten to hand off
  without announcing the round (fixes the intro↔round duplication).
- **`CoachAction.ts`** — `VALIDITY_TTL_MS` per intent + `estimateSpeechMs()`.
- **`CoachingMemory.ts`** — `roundEndsAtMs()` (recorded on `ROUND_STARTED`) for the
  countdown-deadline calculation.
- **`CoachDirector.ts`** — records the round-end deadline on `ROUND_STARTED`.
- **`CoachRuntime.ts`** — sets `expiresElapsedMs` from the validity table; `wouldMissCountdown()`
  preemption before enqueue; resume reconciliation (`flush` + `sink.cancel()` + `sink.resume()`).

No Engine/Host/Event/Session change. The workout timeline is the source of truth; speech
is a live view of it.
