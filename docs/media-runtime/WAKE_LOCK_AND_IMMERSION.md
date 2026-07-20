# INV-002 — Wake Lock, Immersion & The Coach

**Investigation only. No fixes, no workarounds, no hidden-audio/video hacks.** The
question is not *why doesn't wake lock work* — it's *why can't the athlete spend 30
uninterrupted minutes with their Coach?*

Builds on [COACH_CONTINUITY.md](../coaching-runtime/COACH_CONTINUITY.md) (INV-001) and
[WAKE_LOCK.md](./WAKE_LOCK.md) (PR-025 + acceptance investigation).

## Answer (up front)

Two different things, and they are both true at once:

- **Correctness is perfect.** A wake-lock failure never pauses, restarts, or stops the
  workout or the Coach. The Coach survives (INV-001). Corner is behaving correctly.
- **Immersion is platform-conditional.** Wake lock is *immersion protection*, not
  infrastructure. Where the platform **honours** it (Chrome/Android, desktop, Safari iOS
  16.4+ native), the screen stays on and the athlete gets 30 uninterrupted minutes — the
  GOOD path. Where the platform **lacks or ignores** it (iOS < 16.4; and the
  "accepted-but-ignored" case observed on iOS in the acceptance investigation), the screen
  dims and locks and the athlete is repeatedly pulled out to unlock — the BAD path —
  **even though nothing in Corner is broken.**

So: *"Wake lock works"* is not the success criterion, and *"the athlete forgot their phone
existed for thirty minutes"* is only achievable on platforms that respect the lock. On the
platforms where it fails, the failure is an **OS/WebKit limitation**, not a Corner bug —
and Corner already refuses the hacky shims (silent audio / hidden `<video>`) that would
"fix" it at the cost of battery and colliding with the coach's audio.

---

## 1. Git archaeology — the wake-lock timeline

```
root 251fc61 (2026-07-13)
   │  WakeLockManager, MediaRuntime, visibility handlers, useCoachedWorkout — all born here.
   │  Wake lock: acquire on start, release on end, reacquire on visible. Foundational.
   ▼
afd29dc / 65ea193 (07-14)  cross-platform + Chrome-Android gesture speech fixes (audio unlock path)
   ▼
aa37010 (07-14, PR-020A)   voice readiness (touches MediaRuntime, not the lock itself)
   ▼
98dbc54 (07-14, PR-025)    *** the pivotal change ***
   │  ROOT CAUSE FIXED: the wake lock was gated behind audio.unlock(), whose ctx.resume()
   │  can hang on iOS → the lock was never acquired. Fix: acquire the wake lock FIRST in
   │  doBegin, independent of audio. + full request/sentinel instrumentation + counters.
   ▼
8b18a78 (07-14, PR-025 acceptance)
   │  Instrumented request()/sentinel lifecycle; fixed an evidence bug (explicit release
   │  mislabeled 'browser-release'). Documented the six failure cases (A–E) and that iOS
   │  can accept the sentinel yet still sleep the display (Case C).
   ▼
0958ae3 (07-17, PR-031)    opening bell + grace period (touches MediaRuntime/doBegin ordering
   │  around audio; the wake-lock-first ordering from PR-025 is preserved).
   ▼
today
```

- **What changed / when / why:** the only substantive wake-lock behaviour change since the
  root was **PR-025** — moving acquisition *before* audio unlock (because iOS
  `ctx.resume()` can stay pending and block it) and adding deep instrumentation.
- **What improved:** reliability on iOS 16.4+ (the lock is now actually acquired), and full
  on-device observability (counters + request/sentinel evidence).
- **What regressed:** nothing in wake-lock behaviour. PR-031 changed the *audio* ordering
  and added the grace period but kept "wake lock first."

---

## 2. Wake-lock lifecycle today

```
WORKOUT_STARTED
   → MediaRuntime.begin() → doBegin():
        wakeLock.acquire('workout-start')   ← FIRST, independent of audio (PR-025)
             ├─ API absent      → wantActive=true, returns false, status=unsupported (no-op)
             ├─ request REJECTED → status=released, lastError recorded, returns false
             └─ resolved         → sentinel held, status=active, 'release' listener attached
        audio.unlock() (best-effort; gesture fallback armed if it doesn't resolve)
   ↓ round runs, held=true, heldDurationMs climbing
   ↓ screen dims / phone locks  → document hidden
        EngineController.handleHidden → loop.pause() (workout NOT paused — INV-001)
        browser fires sentinel 'release' → sentinel=null, status=released,
             lastReleaseReason='browser-release', lastReleaseVisibility=hidden
             *** but wantActive STAYS true ***  (only release() clears it)
   ↓ athlete unlocks → document visible
        MediaRuntime.handleVisible → wakeLock.reacquireIfWanted('visibility-return')
             wantActive && !sentinel → acquire() again → reacquired++ (if it resolves)
        audio.resume()
WORKOUT_COMPLETED / CANCELLED → end() → release(reason)   (wantActive=false, sentinel released)
dispose() → release('dispose')
```

The lock is serialised through a lifecycle chain so a release can never outrun an acquire.
**Nothing in the engine or coach path awaits the wake lock** — `begin()` is fire-and-forget
off `WORKOUT_STARTED`, and the engine already started (after the grace period, PR-031).

---

## 3. Safari (dim / lock / unlock)

- **Supported?** Yes on **iOS 16.4+ / macOS 16.4+**; **absent below iOS 16.4** (OS
  limitation — `navigator.wakeLock` simply isn't there → Corner reports `unsupported` and
  no-ops).
- **Conditionally supported?** Yes — it requires a **secure context (HTTPS)** and a
  **visible document**; `request('screen')` while hidden rejects.
- **Revoked aggressively?** The browser **auto-releases on hide** (per spec) — expected,
  and Corner reacquires on return. The concerning case is **Case C**: on some iOS
  configurations the sentinel resolves (`held=true`, `heldMs` climbs) yet **the display
  still dims with no `release` line logged** — the OS accepts the lock and ignores it. That
  is a platform behaviour, observable but not overridable from the web layer.
- **Does dimming release it?** If a `browser-release (vis=hidden)` is logged at dim → it was
  released first (Case B/D). If the screen dims with **no** release line → Case C (ignored).
  The instrumentation distinguishes these on-device.
- **Is Corner doing anything wrong?** No. It acquires first, on a visible secure context,
  reacquires on return, and releases cleanly. The evidence path (PR-025) was built to catch
  a Corner bug (Case E: `request()` never called) — and it isn't happening.

---

## 4. Chrome vs Safari

- **Are they behaving differently?** On **desktop/Android**, Chrome has its own Blink
  implementation and honours the lock fully. On **iOS, Chrome === Safari** — every iOS
  browser is WebKit under the hood, so "Chrome iPhone" exhibits *identical* wake-lock
  behaviour to Safari iPhone, including Case C.
- **Both exposing WebKit?** On iOS, yes — one engine, two skins. On other OSes they are
  genuinely different engines (Blink vs WebKit), and both honour the lock.
- **Are we treating them differently?** No — Corner has **zero browser-specific wake-lock
  code**. One injected `navigator.wakeLock` path, same for all.
- **Does one degrade more gracefully?** Degradation is identical and graceful everywhere:
  absent API → silent no-op, workout runs. The *immersion* outcome differs only by whether
  the underlying platform honours the lock — Android/desktop good; iOS variable.

---

## 5. Immersion — the most important section

Evaluate the lock as **immersion protection**, not infrastructure:

| Platform | Wake lock | 30-min uninterrupted? | Immersion |
|---|---|---|---|
| Chrome Android | honoured | yes | **protected** ✅ |
| Chrome/Safari macOS | honoured | yes | **protected** ✅ |
| Safari iOS 16.4+ (native, working) | honoured | yes | **protected** ✅ |
| Safari/Chrome iOS (Case C — accepted-but-ignored) | reports held, screen still sleeps | **no** | **broken** ❌ |
| iOS < 16.4 | absent | no (OS auto-lock) | **broken** ❌ |

- **Where the lock is honoured**, an athlete can run Competition / Technical / Calm / Fight
  Night / Southpaw / Old School start-to-finish, phone down, screen on — the GOOD path.
- **Where it isn't** (the observed iOS case), the athlete lives the BAD path: dim → lock →
  unlock → dim → lock → unlock. The Coach keeps coaching (INV-001), but the *human* is
  thinking about the phone, not boxing. **Immersion is destroyed while correctness is
  intact.** That is precisely the gap this investigation names: the failure is not in the
  code — it's in whether the platform lets the screen stay on.

The honest verdict: **Corner cannot guarantee 30 uninterrupted minutes on platforms that
don't honour the lock**, and it deliberately won't buy that guarantee with a silent-audio /
hidden-video keep-awake hack (battery-hostile, collides with the coach's voice). On those
platforms the immersion ceiling is set by the OS, not by Corner.

---

## 6. Architecture — should a wake-lock failure ever pause / restart / stop the workout or coaching?

**Never — and today's implementation satisfies that.** Verified:

- `doBegin` **fire-and-forgets** `begin()` off `WORKOUT_STARTED`; nothing in the engine or
  coach awaits `wakeLock.acquire()`. A rejected/absent lock returns `false` and the workout
  proceeds untouched.
- `acquire()` failure sets `status` and returns `false` — no throw propagates to the engine
  (the lifecycle chain swallows errors).
- `handleHidden` pauses *ticking*, not the *workout* (INV-001). Wall time keeps elapsing.
- No code path turns a wake-lock outcome into a pause/cancel/reset event.

So a wake-lock failure degrades **only** the screen-on guarantee. It cannot touch the
workout, the coach, or the memory.

---

## 7. Are wake-lock failures polluting personality / immersion UAT?

**Yes — on any test device where the lock isn't honoured.** A session that reads
*Competition → LOCK → unlock → Competition* is not a valid evaluation of the Competition
pack: the dominant felt experience is *fighting the phone*, not *the coach's character*.
Interruptions confound tone, pacing, silence, and micro-coaching — the very things a
personality is judged on. Therefore:

- **Personality UAT must run on a platform that honours the lock** (Chrome Android, or a
  Safari iOS 16.4+ device confirmed working via the diagnostics counters: `held=true` and
  the screen visibly staying on). Otherwise the results measure the OS, not the coach.
- Any prior personality feedback gathered on a locking device should be treated as
  **suspect** until reproduced on a non-locking one.

---

## The ten answers

1. **What changed in wake lock's history?** Foundational at the root; the one real change is
   **PR-025** (acquire before audio unlock + instrumentation). PR-031 preserved the ordering.
2. **What is Safari doing today?** Honours the lock on 16.4+ (secure, visible); auto-releases
   on hide (reacquired on return); on some iOS configs accepts the sentinel but still sleeps
   the display (Case C). Absent below 16.4.
3. **What is Chrome doing?** On iOS, identical to Safari (WebKit). On Android/desktop, its own
   engine, honours the lock fully.
4. **What survives a wake-lock failure?** Everything that matters — engine, coach, memory,
   queue, workout state, audio objects (INV-001). The workout keeps running.
5. **What is merely suspended?** The screen-on guarantee (and, when the screen locks, the
   AudioContext/speech until visibility returns). Nothing dies.
6. **Are workouts ever at risk?** No — never paused/restarted/stopped by a lock outcome.
7. **Are wake-lock failures harming immersion?** Yes, on platforms that don't honour the lock
   — repeated unlocks pull the athlete out, despite the coach continuing.
8. **Can we evaluate personalities while this fails?** Not fairly — the interruptions confound
   the evaluation; UAT must move to a lock-honouring platform.
9. **Is Corner behaving correctly despite the failures?** Yes — correctness is intact; the
   failures are OS/WebKit limitations, and Corner degrades gracefully without hacks.
10. **What to investigate next?** The real immersion frontier for locking platforms:
    **"Can Corner be trained ears-only, screen-off?"** — if the screen *will* sleep on iOS,
    the question becomes whether the coach's **audio** (not just its state) survives an
    extended screen-off, or stalls until a gesture (see
    [WHERE_IS_SPEECH_DYING.md](./WHERE_IS_SPEECH_DYING.md)). Pair it with defining the
    **UAT device/browser matrix** so personality investigations run only where the lock
    holds.

---

*Success criterion — "the athlete forgot their phone existed for thirty uninterrupted
minutes" — is **met where the platform honours the wake lock, and blocked by the OS where it
does not**. Corner is correct on all platforms; immersion is capped by the platform, and
the honest fix is not a web hack but choosing where the experience is evaluated and shipped.*
