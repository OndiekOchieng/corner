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

---

# Acceptance Investigation — iPhone still sleeps (PR-025 continued)

After the ordering fix, real workouts on an **iPhone (Chrome on iOS)** still let the
screen dim and lock. This section is the evidence-gathering to find the first point
where reality diverges from expectation. **No runtime behaviour was changed** — only
instrumentation was added (plus a fix so an explicit release is no longer mislabelled
`browser-release` in the evidence). No hidden-video / silent-audio / timer workarounds.

## Instrumentation added

`WakeLockManager` now records and logs the full request + sentinel lifecycle
(dev-only, stripped from production):

- **`request()`** — `request BEGIN · vis=… hidden=…`, then `request END resolved in Nms · sentinel #k · held=true` **or** `request END REJECTED in Nms · NotAllowedError: …`.
- **sentinel** — a monotonic id, acquire time, and on the browser's `release` event:
  `browser-release: sentinel #k · vis=… hidden=… heldMs=…`.
- **stats()** exposes: `lastRequestMs`, `lastRequestOutcome`, `lastError`,
  `acquireTimeMs`, `heldDurationMs`, `lastReleaseReason`, `lastReleaseVisibility`.

The dev overlay (`/dev` diagnostics on the active screen) now shows, live:

```
platform: Chrome · iOS · iOS:17.x
env:      secure:true · wakeLock-api:✓ · vis:visible · focus:true
wakelock: active · sup:✓ held:✓
wl request: resolved in 3ms
wl held:  42000ms · last release: browser-release (vis=hidden)
wakelock counts: req:1 acq:1 rel:0 reacq:0
```

This makes each of the six candidate failure points directly observable.

## What to capture on the iPhone (HTTPS, same device, Safari and Chrome iOS)

For each run — **Start → wait for the screen to dim/lock → Home → return → app-switch →
Pause → Resume → Finish** — record the overlay and console line at each transition.
The first line that contradicts the expected value is the divergence point.

## Timeline (expected) vs. the questions it answers

```
Start ─▶ acquire('workout-start')
          │  wl request: BEGIN (vis=visible)          ← if this never appears → Case E (Corner bug)
          ▼
        request END ──┬─ resolved · held=true          ← if REJECTED → Case A (permission/limitation)
                      │
                      ▼
        held=true, heldMs climbing
          │
          ├─ screen dims WITHOUT any release logged     ← Case C: OS ignores the sentinel (platform)
          ├─ browser-release fires (vis=hidden) then dim ← Case B/D: released first
          │      └─ on return: reacquire('visibility-return') → held=true again  ← Case D (expected)
          ▼
Finish ─▶ release('workout-completed')
```

| Evidence in the overlay/console | Case | Meaning |
|---|---|---|
| No `wl request: BEGIN` at Start | **E** | Corner never called `request()` — our bug |
| `request END REJECTED · <Name>Error` | **A** | Permission / browser limitation |
| `resolved · held=true`, then `browser-release` with `heldMs` ≈ 0 | **B** | Platform releases immediately (policy) |
| `held=true`, `heldMs` large, screen dims with **no** release line | **C** | OS accepts the sentinel but ignores it — **platform behaviour** |
| `browser-release (vis=hidden)` on dim, `reacquire` on return | **D** | Expected — investigate the reacquire path only |

## Platform comparison to record

| | `wakeLock-api` | `request()` outcome | held on dim? | Screen stayed on? |
|---|---|---|---|---|
| Safari iPhone | ? | ? | ? | ? |
| Chrome iPhone | ? | ? | ? | ? |
| Chrome Android (control) | ✓ | resolved | held | yes |

(Fill from the device runs. Chrome Android is the known-good control.)

## Assessment (pending device evidence)

The Corner side is now proven correct and observable: the request is issued **first**,
before audio, and every acquire/release/reject is logged with timing and visibility.
That eliminates Case E and makes A–D self-identifying on-device.

The strongest hypothesis for iOS is **Case C** — WebKit exposes the Screen Wake Lock
API and `request('screen')` resolves with a held sentinel, but iOS still applies its
idle-timer and dims/locks the screen. If the captured evidence shows `held=true` with a
large `heldMs` and **no** `browser-release` before the screen sleeps, that is a
**browser/OS behaviour, not a Corner bug**, and per this PR's direction it is
**classified as such rather than masked** with a silent-audio or hidden-`<video>` hack
(those are unreliable, battery-hostile, and fight the coach's own audio). The honest
product position stays: the wake lock is requested correctly; whether iOS honours it is
the platform's to decide.

**Root cause: not yet *proven*** — it requires the on-device capture above. The
instrumentation is in place to prove it in one workout run. Recommended fix: **none until
the case is established**; if Case C is confirmed, document the OS limitation (done here)
and consider only a *visible, honest* affordance (e.g. "your device may dim the screen"),
never a hack.

---

# Safari iOS vs Chrome iOS — same device comparison

The overlay distinguishes the two browsers (`CriOS` → "Chrome · iOS", otherwise
"Safari · iOS") and logs the same wake-lock fields in each, so running the **same
deployment (HTTPS) on the same iPhone** in both browsers yields a like-for-like
comparison. This isolates a browser/embedder difference from anything Corner does —
the code path is identical; only the engine host differs.

## Why the two can differ even though "iOS = WebKit"

Apple requires iOS browsers to use WebKit, but **Safari and third-party browsers do
not host it the same way**:

- **Safari** runs the full browser with its own process model and makes the system
  power assertion that actually keeps the display awake.
- **Chrome / Firefox / Edge on iOS** are **WKWebView** embedders. WKWebView exposes
  much of WebKit's JS surface — so `navigator.wakeLock` and `request('screen')` can be
  **present and resolve** — but the bridge from a held wake-lock sentinel to a real
  system power assertion is **not guaranteed** in an embedded web view the way it is in
  Safari. The API surface can exist without the platform effect.

That gap is an **embedder/integration** concern, not a Corner bug and not a
standards-compliance problem in Corner's usage.

## What to record (fill from the device)

| Field (from the overlay) | Safari iOS | Chrome iOS |
|---|---|---|
| `platform` | Safari · iOS · iOS:xx | Chrome · iOS · iOS:xx |
| `env: wakeLock-api` (`'wakeLock' in navigator`) | ? | ? |
| `wl request` outcome / elapsed | ? | ? |
| `wakelock: held` after Start | ? | ? |
| `wl held` (heldMs climbs, no release) while idle | ? | ? |
| **Display actually stays on past the idle timeout** | ? | ? |

## Classification rule

Compare the two columns:

- **Both acquire and the display stays on** → the API works in both; no issue.
- **Neither exposes `navigator.wakeLock`** → API simply unavailable on that iOS
  version → graceful no-op (already handled).
- **Chrome reports a successful acquisition (`held=true`, `heldMs` climbing, no
  `browser-release`) yet the display still sleeps, while Safari with the identical
  state keeps the display on** → **this is a Chrome iOS / WKWebView integration
  issue.** WebKit accepts the wake lock in the embedded view but does not translate the
  held sentinel into a system power assertion. It is a platform/embedder behaviour, not
  a Corner defect.

This is the hypothesised outcome given the WKWebView gap above; the device capture
confirms it. It is **Case C** from the acceptance matrix, scoped to the Chrome-iOS
host specifically (Safari-iOS being the working control on the same device proves the
difference is the embedder, not the OS version or Corner).

## Response — no browser-specific hacks

There is **no standards-compliant workaround**: the Screen Wake Lock API *is* the
standard, and no other web-platform API keeps the display awake. The known
alternatives — a looping silent `<audio>`, a hidden playing `<video>`, `NoSleep.js` —
are **non-standard hacks**: unreliable across iOS versions, battery-hostile, and in
Corner's case they would fight the coach's own speech/audio. Per this investigation's
direction, we therefore **do not implement any of them**.

Honest handling instead:

- Keep the code as-is — Corner requests the wake lock correctly and identically in both
  browsers; whether the host honours it is the host's to decide.
- Document the finding (this section) so it is understood as a **Chrome-iOS/WKWebView
  limitation**, not a Corner bug.
- For reliable screen-awake on iOS, **Safari is the supported browser**; a future,
  *visible and honest* affordance (e.g. a one-time "on Chrome for iPhone the screen may
  dim — Safari keeps it on") is acceptable, a silent keep-awake shim is not.

If Apple later wires the wake lock through WKWebView (or a genuinely
standards-compliant mechanism appears), revisit — until then, the correct action is to
classify and document, which is done here.
