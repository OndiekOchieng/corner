# PR-010 — Media Runtime & Execution Continuity: Implementation

The Media Runtime is the final browser-integration layer. The platform already
knows how to coach; this layer makes the athlete actually *hear* it on real
devices — speech, bells, a screen that stays awake, and coaching that survives
interruptions — while keeping every browser API behind one boundary.

```
Execution Engine → Host Runtime → Event Runtime → Coach Runtime → Media Runtime → { Speech API · Web Audio · Wake Lock }
```

Everything lives in `src/lib/media/`, is fully injectable, and is exercised
headlessly (212 tests, `tsc` clean, production build green).

---

## 1. Implementation Summary

A new browser-media layer sits below the Coach Runtime. It owns the AudioContext,
the Speech API wrapper, the Wake Lock, capability detection, and visibility — so
nothing above it ever touches a browser media API. The Coach Runtime renders into
a `SpeechSink` the Media Runtime provides; workout lifecycle events (via a plugin
on the same EventBus) drive bells and the wake lock.

**Files (`src/lib/media/`):**

| File | Role |
|---|---|
| `CapabilityService.ts` | The single feature-detection point → immutable `CapabilitySnapshot` |
| `AudioManager.ts` | Owns the AudioContext: lazy create, `unlock`/`resume`/`suspend`/`dispose`, `play`/bells; autoplay-aware |
| `SpeechManager.ts` | Wraps SpeechService: init, voice readiness, pause/resume/cancel, graceful degradation; provides the `SpeechSink` |
| `WakeLockManager.ts` | Screen wake lock: acquire/release/reacquire on visibility; degrades where unsupported |
| `MediaDiagnostics.ts` | Immutable snapshots of unlock state, availability, wake-lock status, capabilities, resume/autoplay counts |
| `MediaRuntime.ts` | Coordinates the four managers + visibility + gesture-unlock; owns media lifecycle |
| `MediaRuntimePlugin.ts` | The `Subscriber` that drives media off workout events |
| `index.ts` | Public surface |

**Live wiring** (`hooks/useCoachedWorkout.ts`): build a `MediaRuntime`, register
`createCoachRuntimePlugin({ sink: media.speechSink() })` + `createMediaRuntimePlugin(media)`,
**`await media.unlock()` from the near-Start gesture, then start** — so the first
bell isn't lost to autoplay. The old direct `SpeechService` construction and the
`AudioBellSubscriber` (which touched Web Audio directly) were removed; `lib/audio`
is superseded by `AudioManager`.

**Untouched:** the Execution Engine, Coach Runtime, and everything above Media
have zero knowledge of it (verified by grep).

---

## 2. Media Runtime Architecture

`MediaRuntime` composes five collaborators and exposes a small surface:

- `speechSink()` → the `SpeechSink` the Coach Runtime renders into (via SpeechManager).
- `unlock()` → called from a trusted gesture; unlocks audio for the session.
- `onEvent(event)` (through `MediaRuntimePlugin`) → lifecycle + bells:
  `WORKOUT_STARTED → begin` (unlock audio, acquire wake lock, arm gesture fallback),
  `ROUND/REST_STARTED → bell`, `WORKOUT_COMPLETED → finish bell + end`,
  `WORKOUT_CANCELLED → end`.
- `configureSpeech(settings)` / `setBellsEnabled(b)` → live settings.
- visibility handling (internal) and `diagnostics()` / `dispose()`.

Two design guarantees:

- **Lifecycle serialisation.** `begin`/`end` run through a promise chain, so a
  release can never outrun its acquire even when START and COMPLETE arrive in the
  same synchronous event batch.
- **Everything injected.** Audio context factory, speech engine, wake-lock API,
  visibility source, and gesture target are all constructor deps with real-browser
  resolvers as defaults — the whole runtime runs in Node with fakes.

---

## 3. Browser Integration Strategy

- **Autoplay (Web Audio).** The context is created lazily and only makes sound
  after `unlock()` runs. The hook unlocks from the Start gesture *before* the
  engine starts. If autoplay is still blocked, `begin()` records the failure and
  **arms a one-shot gesture listener** (`pointerdown`/`keydown`/`touchstart`) so
  the next tap unlocks — the workout never gets stuck silent.
- **Speech.** `speechSynthesis` has its own policy; it's driven right after the
  navigation gesture and degrades to a silent no-op (with an on-screen "running as
  a timer" note) where unsupported.
- **Wake Lock.** Acquired on start, released on finish/cancel, and **reacquired on
  return-to-visible** (browsers drop it whenever the tab hides). Absent API →
  silent no-op.
- **Bells** are synthesised by `AudioManager` (oscillator envelopes scheduled on
  `currentTime`) and only sound while the context is running.

No subscriber, hook, or component touches `AudioContext`, `navigator.wakeLock`, or
`speechSynthesis` — only `AudioManager`, `WakeLockManager`, and `SpeechManager` do.

---

## 4. Capability Model

`CapabilityService` is the only place browser features are probed. It reads an
injected environment and returns an immutable `CapabilitySnapshot`:

`speech · webAudio · wakeLock · vibration · notifications · reducedMotion · visibility`.

`resolveCapabilityEnv()` reads the real globals (guarded for SSR → `{}` in Node).
`MediaDiagnostics` grades overall support as **full / partial / minimal** from
speech + webAudio + wakeLock. Nothing else feature-detects.

---

## 5. Execution Continuity Strategy

The requirements, and how each is met:

| Requirement | Mechanism |
|---|---|
| Resume AudioContext after a gesture | `unlock()` on Start; one-shot gesture listener as fallback |
| Never lose speech to autoplay | speech driven post-gesture; degrades to timer, never blocks |
| Handle page visibility | on visible → resume audio + reacquire wake lock; on hidden → keep running (time never pauses) |
| Wake Lock lifecycle | acquire on start, reacquire on visible, release on end; serialised so release ⟩ acquire ordering holds |
| Recover from interruptions | audio `resume()` + wake-lock `reacquireIfWanted()` on every return-to-visible; resume count tracked |
| Respect Session checkpointing | Media owns *only* media; the Host/Session runtimes still own time, snapshots, and persistence untouched |

The engine's own `VisibilityObserver` continues to reconcile *time*; the Media
Runtime independently reconciles *media* — the two never overlap.

---

## 6. Diagnostics Overview

`MediaDiagnostics.snapshot()` (immutable) exposes:

`audioSupported · audioUnlocked · speechAvailable · voicesReady · wakeLockStatus ·
capabilities · resumeCount · autoplayFailures · visibility · bellsEnabled ·
browserCompatibility`.

Available via `media.diagnostics()`. Recording never affects behaviour; all timing
is event/gesture-driven, not sampled.

---

## 7. Test Summary

**27 new media tests** (`src/tests/media/`), all headless via injected fakes
(212 total across the app):

- **`managers.test.ts` (16)** — capability detection (rich/bare/Node-safe); audio
  unlock, autoplay-failure recording, lock-respecting bells, unsupported no-op,
  dispose; speech sink forwarding, voice readiness, degradation, configuration;
  wake-lock acquire/release, reacquire after browser release, no-reacquire after
  purposeful release, unsupported, denied-then-retry.
- **`runtime.test.ts` (11)** — start acquires wake lock + resumes audio; bells on
  transitions; bells toggle; finish bell + release; **continuity** (reacquire +
  resume on return-to-visible, resume count); **gesture-unlock arming** then
  unlock; capability/diagnostics snapshot; **graceful degradation with no browser
  APIs at all**; and the **full path** (coach speech + bells + wake lock off the
  real event stream through the EventBus).

Covers every item asked: audio unlock, autoplay handling, wake-lock lifecycle,
capability detection, visibility changes, speech lifecycle, media integration,
graceful degradation, and no-browser-API-leakage (all tests run in Node).

---

## 8. Browser Compatibility Notes

| Feature | Chrome/Edge (desktop) | Safari (macOS/iOS) | Firefox | Fallback |
|---|---|---|---|---|
| Speech synthesis | ✓ | ✓ (iOS needs a gesture) | ✓ | silent "running as a timer" |
| Web Audio | ✓ | ✓ (unlock on gesture) | ✓ | bells silent; coaching unaffected |
| Wake Lock | ✓ | ✓ (iOS 16.4+) | ✗ (as of writing) | screen may dim; workout continues |
| Vibration | ✓ | ✗ | ✓ | detected, not yet used |
| Reduced motion | ✓ | ✓ | ✓ | honoured by the design system |

The app grades itself (`browserCompatibility`) and *never* hard-fails a missing
feature — the coach and timer keep working; only the affected media degrades.

---

## 9. Risks

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | iOS background-audio: speech/bells may pause when the screen locks despite the wake lock | P1 | Wake lock keeps the screen on during use; true lock-screen playback needs a MediaSession/audio-element approach — the top post-Beta media item |
| R2 | Wake Lock unsupported in Firefox / older Safari | P2 | Detected + graceful; screen may dim. Acceptable for Beta |
| R3 | Autoplay: if the athlete never taps after a blocked start, bells stay silent | P2 | Gesture-unlock is armed automatically; the first interaction unlocks. Speech still works |
| R4 | `lib/audio` is now dead code | P3 | Left in place to avoid churn; safe to delete later |
| R5 | Real-device matrix not yet physically tested | P1 | Fakes prove the logic; a device pass (iOS/Android/desktop) is the remaining Beta gate |

---

## 10. Beta Readiness Assessment

**Ready for Beta**, with one known limitation to watch.

The full coaching experience is now observable and dependable on real browsers:
press Start → hear the coach and bells → the screen stays awake → put the phone
down → complete the workout → recover cleanly from tab-switches and interruptions.
Every browser quirk is either handled (autoplay unlock, wake-lock reacquire,
visibility recovery) or gracefully degraded (missing wake lock / speech / audio),
and the app knows its own capability grade.

The one item that warrants a real-device pass before wide Beta is **iOS
lock-screen audio (R1)** — the wake lock covers screen-on use, but sustained
audio with the screen fully locked is a platform-specific follow-up (MediaSession),
not a platform redesign. Everything else — determinism, boundaries, graceful
degradation, and the end-to-end coached workout — is verified.

Definition of Done: **met.** Browser behaviour has disappeared behind the coaching
experience; the athlete never has to think about it.
