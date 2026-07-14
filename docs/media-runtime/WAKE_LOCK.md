# Wake Lock — Verification & Hardening (PR-025)

Corner keeps the phone's screen awake for a workout laid on the floor. This document
verifies that the `WakeLockManager` is *actually* holding the lock across the whole
lifecycle — not just that the abstraction exists — records the cross-platform reality,
and documents the one real defect found and fixed.

Owner: `src/lib/media/WakeLockManager.ts`, driven by `src/lib/media/MediaRuntime.ts`.

---

## Lifecycle (verified)

```
WORKOUT_STARTED
   │ MediaRuntime.onEvent → begin() → doBegin()
   ▼
 wakeLock.acquire('workout-start')          ← taken FIRST, before audio (see root cause)
   │ navigator.wakeLock.request('screen')
   ▼
 sentinel stored · status = active · addEventListener('release', …)
   │
   ├─ WORKOUT_PAUSED / WORKOUT_RESUMED  → not handled → lock is NOT touched (stays held)
   │
   ├─ tab hidden      → browser drops the sentinel → 'release' fires → sentinel = null
   ├─ tab visible     → handleVisible → reacquireIfWanted('visibility-return') → re-acquire
   │
   ▼
WORKOUT_COMPLETED → end('workout-completed') → release
WORKOUT_CANCELLED → end('workout-cancelled') → release
dispose()          → release('dispose')
```

Every transition is covered by tests in `src/tests/media/runtime.test.ts`:

| Transition | Behaviour | Test |
|---|---|---|
| Workout start | acquires the lock | ✓ |
| Audio unlock hangs (iOS) | **still** acquires the lock | ✓ (the fix) |
| Pause / Resume | lock held throughout | ✓ |
| Visibility hide → show | reacquires, counts it | ✓ |
| Completion | releases | ✓ |
| Quit (`WORKOUT_CANCELLED`) | releases | ✓ |
| Unmount (`dispose`) | releases | ✓ |
| Unsupported API | graceful no-op, `status = unsupported` | ✓ |

`wantActive` is kept independently of the sentinel, so a browser-initiated drop (tab
hidden) is remembered and re-acquired on return; `enqueueLifecycle` serialises
begin/end so a release can never outrun its acquire.

## Root cause found — and fixed

**The wake lock was gated behind audio unlock, which can hang on iOS.** The old
`doBegin` was:

```ts
const unlocked = await this.audio.unlock();   // ctx.resume() — can stay PENDING on iOS
await this.wakeLock.acquire();                 // ← never reached if the line above hangs
```

`AudioManager.unlock()` does `await ctx.resume()`. On iOS Safari, `AudioContext.resume()`
can stay **pending** (not reject) when there is no active user gesture — the same
behaviour that caused the PR-013 start-up hang. When that happens, `doBegin` blocks on
the audio line and **never reaches `wakeLock.acquire()`**, so the screen can sleep mid-
workout *even on iOS versions where the Wake Lock API is fully supported*. This is a
Corner ordering bug, not an OS limitation.

**Fix (PR-025):** take the wake lock **first**, independent of audio — they are separate
concerns and the screen-awake guarantee must not depend on audio succeeding.

```ts
await this.wakeLock.acquire('workout-start'); // screen awake up front
const unlocked = await this.audio.unlock();   // audio can hang without affecting the lock
if (!unlocked) this.armGestureUnlock();
```

Proven by test: with `ctx.resume()` hanging, the wake lock is still `active` while audio
stays locked — the two are decoupled.

## Diagnostics (dev-only)

`WakeLockManager` logs every acquire/release with a reason (`[WakeLock] workout-start →
acquired`, `browser-release → dropped (tab hidden)`, `workout-completed → released`, …),
stripped from production by inline `NODE_ENV` checks. Counters are surfaced live through
`MediaDiagnostics` and the dev overlay (`/` active screen, `components/dev/WorkoutDiagnostics.tsx`):

- **supported** · **status** (`unsupported | released | active`) · **held** (sentinel now)
- **requested** · **acquired** · **released** · **reacquired**

Use these to confirm on a real device: after Start, `status=active held=true acquired=1`;
after hiding and returning, `reacquired` increments; after finish/quit, `status=released`.

## Cross-platform matrix

| Browser | Screen Wake Lock API | Corner behaviour |
|---|---|---|
| **Chrome Android** | ✅ supported | Full — acquire/reacquire/release as above |
| **Chrome macOS** | ✅ supported | Full |
| **Safari macOS** | ✅ supported (16.4+) | Full |
| **Firefox (desktop)** | ✅ supported (126+); ❌ older | Full where supported; graceful no-op otherwise |
| **Safari iPhone** | ⚠️ **iOS 16.4+ only** | Supported on 16.4+ (now that the ordering bug is fixed); graceful no-op below 16.4 |
| **Chrome iPhone** | ⚠️ same as Safari iOS | All iOS browsers use WebKit, so identical to Safari iOS |

Graceful degradation: where `navigator.wakeLock` is absent, the manager reports
`unsupported` and every call is a silent no-op — no errors, workout still runs.

## iPhone — support status

- **iOS 16.4+ (March 2023):** the Screen Wake Lock API **is** available in WebKit, so it
  works in Safari **and** Chrome/any browser on iOS (all use WebKit). With the PR-025
  ordering fix, Corner now acquires it reliably even when audio is still unlocking.
- **iOS < 16.4:** the API is **absent** — this is an **OS limitation, not a Corner bug**.
  Corner degrades to a no-op. Best available fallback on those devices: keep the screen
  from idling by other means the web platform allows (none are reliable), or rely on the
  athlete raising their phone's auto-lock timeout. We do **not** ship a hacky
  silent-audio/`<video>` keep-awake shim; it is unreliable, battery-hostile, and would
  conflict with the coach's audio. The honest position is: on iOS 16.4+ it works; below
  that, the OS does not offer it.

## Summary

The abstraction was correct, but its **invocation order** let audio block the lock on
iOS. Fixed by acquiring the wake lock first. All transitions are now verified by tests
and observable on-device via the diagnostics counters. No Engine, Host, Event, Coach, or
Session changes.
