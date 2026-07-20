# INV-001 — The Coach Never Stops Coaching

**Investigation only. No code, no fixes.** One question: *does the Coach ever stop
coaching?* — which is not the same as *does speech stop?*

## Answer (up front)

**The Coach never stops coaching.** Speech **sleeps** (the browser suspends audio while the
screen is locked) and **resumes** on unlock. The Coach Runtime, its memory, the Engine, the
bus, and the queue all **survive** a lock untouched — because a screen lock never unmounts
the component that owns them. On unlock the workout is fast-forwarded to the real
wall-clock moment and the coach continues from *there* — it never restarts, never says
"Welcome to Corner." Corner provides the **GOOD** experience, and satisfies the philosophy:
*the Coach merely slept.*

The one honest caveat is temporal, not identity: after a long lock the coach resumes at the
*current* point in the workout (correctly), and stale lines queued before the lock are
dropped rather than blurted — see [§5](#5-continuity-verdict).

---

## Why the Coach can't restart (ownership)

`useCoachedWorkout` builds the whole runtime inside `useEffect(..., [workout.id])` and holds
it in refs (`runtimeRef`, `coachRef`, `mediaRef`). A screen lock/unlock is a
`visibilitychange`, **not** an unmount and **not** a `workout.id` change — so the build
effect does **not** re-run. `WORKOUT_STARTED` (the only thing that calls `convo.reset()`)
fires exactly once, at `controller.start()`. Therefore lock/unlock cannot reset memory or
re-introduce the session. The only way to get "Welcome to Corner" again is a real remount
(new workout / navigation), which a lock is not.

---

## 1. Lifecycle — what survives, what sleeps

```
                         SCREEN LOCK  (document → hidden, visibilitychange)
                              │
   ┌──────────────────────────┼───────────────────────────┐
   │  SURVIVES (in-memory,     │   SLEEPS (browser policy)  │
   │  never unmounted)         │                            │
   │  • Engine + Workout State │   • AudioContext → suspended (browser)
   │  • Coach Runtime          │   • speechSynthesis playback paused
   │  • Coaching Memory        │   • Wake Lock → auto-released by the browser
   │  • Event Bus              │   • RuntimeLoop → paused (no ticks; RAF is
   │  • Queue (+ temporal TTLs)│     throttled while hidden anyway)
   │  • SpeechService object   │
   │  • AudioManager object    │   NOTE: the WORKOUT is NOT paused. Wall time
   │  • Bell (decoded buffer)  │   keeps elapsing; only *ticking* stops.
   └──────────────────────────┴───────────────────────────┘
                              │
                         SCREEN UNLOCK  (document → visible)
                              │
   EngineController.handleVisible():  reconcile → engine.advance() to clock.now()
                                      → fast-forward past any boundaries crossed
                                      → loop.resume()
   MediaRuntime.handleVisible():      audio.resume()  +  wakeLock.reacquireIfWanted()
                              │
                     Coach processes the forward events, orients to the CURRENT
                     phase, and continues. Speech resumes. Memory intact.
```

The engine derives time from a **clock** (`performance.now`), never from accumulated
frames (`HostClock`), so a single `advance()` on unlock recovers the true elapsed time even
if JS was fully frozen during the lock (iOS). This is the mechanism that makes continuity
possible.

---

## 2. What actually sleeps (dim vs lock vs unlock)

| Phase | What happens |
|---|---|
| **Dimming** | If the Wake Lock is held, the OS shouldn't dim at all — that's its job. If it dims, the page is still *visible*, so no `visibilitychange` fires: **everything runs, audio plays, nothing sleeps.** |
| **Locking** | Page → hidden. `EngineController.handleHidden` records `hiddenAt` and `loop.pause()` (stops ticking, **does not pause the workout**). `MediaRuntime.handleHidden` deliberately does **nothing** to audio/speech ("the workout keeps running"). The **browser** then suspends the AudioContext + speech and releases the Wake Lock. On iOS the whole page/JS is frozen. |
| **Unlocking** | Page → visible. `handleVisible` reconciles the clock (fast-forward), resumes the loop, resumes the AudioContext, and reacquires the Wake Lock. Coach resumes. |

So of the options in the prompt: **A (speech suspension)**, **B (AudioContext suspension)**,
and **C (WebKit/Safari media suspension)** all happen — and are **browser-driven, expected
behaviour**. **D (workout suspension) does NOT happen** — the workout keeps elapsing in wall
time; only rendering/ticking pauses. Nothing "dies."

---

## 3. Did we ever lose state?

**No.** `CoachingMemory` is a plain object held by the surviving Coach Runtime. Across a
lock it still knows:

| State | Survives? | Where it lives |
|---|---|---|
| Current round / round-end time | ✅ | `CoachingMemory` (`enterRound`, `roundEndsAtMs`) |
| Taught dimensions | ✅ | `taughtDimensions` set |
| Reinforcement counts | ✅ | `reinforcementCounts` |
| Vocabulary progression (call signs) | ✅ | `introducedCallSigns` |
| Combinations exposed | ✅ | same (`noteCallSignIntroduced` at commit time) |
| Queue contents | ✅ | `QueueManager` (in the runtime) |
| Temporal validity (TTLs) | ✅ | each action's `expiresElapsedMs` |

Because nothing is reset, the sequence is **GOOD** (`Round 2 → lock → unlock → still Round
2`, or correctly *Round 3* if the round boundary genuinely passed during the lock), never
**BAD** (`→ Welcome to Corner`) and never **VERY BAD** (`→ silence forever` — the
AudioContext/speech resume on `handleVisible`).

---

## 4. Git archaeology — when did this appear?

The continuity machinery is **foundational**, not introduced by a later PR.

| File | First appears | Later changes touching continuity |
|---|---|---|
| `EngineController` (loop.pause on hidden, fast-forward on visible) | **root `251fc61`** | **none** — unchanged since the root commit |
| `VisibilityObserver` | **root `251fc61`** | none |
| `RuntimeLoop` (pause/resume ticking) | **root `251fc61`** | none |
| `HostClock` (wall-clock time source) | **root `251fc61`** | none |
| `MediaRuntime` visibility handlers | root | PR-025 (reacquire Wake Lock on visible), PR-020A, PR-031 |
| `WakeLockManager` (reacquireIfWanted) | root | **PR-025** hardened reacquire + instrumentation |
| `SpeechService` (suspend/resume is browser) | root | `2f4b40b` "disposal no longer cancels the shared global engine" (fixed teardown silence), `65ea193` Chrome-Android gesture, PR-020A voice readiness |

Answers:
- **When did speech suspension first appear?** It isn't *ours* — it's browser media
  suspension, present since the platform's foundation. Our *handling* of it (pause ticking,
  reconcile on visible, don't pause the workout) exists since the **root commit**.
- **Has this behaviour always existed?** Yes.
- **Did a merged PR introduce it?** No — foundational.
- **Did a merged PR improve it?** Yes: **PR-025** (Wake Lock verification + reacquire-on-
  visible, iOS ordering fix), **PR-021** (temporal consistency — stale actions expire
  rather than replay), and `2f4b40b` (teardown no longer kills the shared speech engine).
- **Is this expected browser behaviour?** Yes — AudioContext/`speechSynthesis` suspension on
  background/lock (especially WebKit/iOS) is standard; the design anticipates it.

---

## 5. Cross-platform (Safari vs Chrome vs WebKit)

| | dim | lock | unlock |
|---|---|---|---|
| **Safari / iOS** | no `visibilitychange` (page visible) | page **frozen**: JS halts, AudioContext suspended, Wake Lock released | JS thaws → `handleVisible` reconciles via wall-clock → audio + wake lock resume |
| **Chrome (desktop/Android)** | page visible | hidden: RAF/timers throttled, AudioContext may suspend, Wake Lock released | `handleVisible` reconciles → resume |

- **What survives:** all in-memory runtime state, on both.
- **What sleeps:** AudioContext + speech (both); on iOS, *all* JS execution (frozen).
- **What dies:** nothing.
- **What resumes:** ticking, audio, speech, wake lock — on both.

**Are Safari and Chrome behaving differently?** Only in *degree*: iOS/WebKit fully **freezes**
the page (JS stops) while Chrome **throttles** it. Both are exposing the same underlying
media-suspension policy. Corner survives both **identically** because time is reconciled
from the clock, not from frames — so a frozen page (iOS) and a throttled page (Chrome)
recover to the same correct point. This is WebKit behaviour surfaced two ways, not two
different bugs.

---

## 6. Continuity verdict

Corner delivers the **GOOD** experience:

```
Coach: "Move your feet."  →  LOCK  →  90 s  →  UNLOCK  →  Coach continues (current phase)
```

- The coach's *identity and memory* persist perfectly — it is the same coach, mid-workout.
- The *timeline* is honest: after 90 s the workout really is 90 s further along, and the
  coach resumes there (it does not rewind or restart).
- Stale pre-lock queued lines are **dropped** on unlock (their `expiresElapsedMs` is long
  past when `queue.drain` runs at the fast-forwarded `elapsedMs`), so the athlete is not hit
  by a 90-second-old "Move your feet." on return — a deliberate temporal-consistency
  property (PR-021), not a loss of continuity.

---

## 7. Philosophy verdict

> *The Coach should survive whatever the phone decides to do.*

**Satisfied today**, for dimming, locking, unlocking, media suspension, and Wake Lock
release (auto-reacquired). The athlete feels *the Coach merely slept*, not *the Coach
disappeared*. The failure modes that would violate this — a rebuild on visibility, a memory
reset, a queue that replays stale lines, or audio that never resumes — are all absent:
the runtime is ref-owned (no rebuild), memory only resets on `WORKOUT_STARTED` (once),
temporal TTLs drop stale lines, and `handleVisible` resumes audio.

Residual risk lives only at the browser boundary the earlier investigations mapped
([WHERE_IS_SPEECH_DYING](../media-runtime/WHERE_IS_SPEECH_DYING.md),
[WAKE_LOCK](../media-runtime/WAKE_LOCK.md)): if `AudioContext.resume()` doesn't complete on
unlock (a WebKit autoplay quirk), the *next* line could be delayed until a gesture — but
that is speech latency, not the Coach stopping. The Coach itself never stops.

---

## The seven answers

1. **Does the Coach ever stop coaching?** No.
2. **Does speech die or merely sleep?** Sleeps — suspended by the browser, resumed on unlock.
3. **What survives locking?** Engine, Coach Runtime, Coaching Memory, Event Bus, Queue,
   temporal TTLs, SpeechService/AudioManager objects, decoded bell, workout state.
4. **What sleeps?** AudioContext + speech playback + Wake Lock (browser); the tick loop
   (ours). The workout does **not** pause — wall time keeps elapsing.
5. **Do we ever lose continuity?** No — no reset, no restart; stale lines are dropped, not
   replayed.
6. **Did a merged PR introduce or improve this?** Introduced at the root commit; improved by
   PR-025 (wake lock), PR-021 (temporal), and the shared-engine teardown fix.
7. **Can Corner survive an arbitrarily long lock and preserve coaching?** Yes — because time
   is reconciled from the clock, an arbitrarily long lock fast-forwards correctly on unlock;
   memory is untouched; the coach resumes at the true current moment. The only thing that
   grows with lock length is how far the workout advanced — which is correct.

*Success criterion — "The Coach never stopped coaching" — is met.*
