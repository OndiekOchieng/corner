# PR-013 — Cross-Platform Compatibility Audit

Browser-integration fixes only — no engine, coach-runtime, or architecture changes.
The platform is deterministic and correct; these are the places browser reality
diverged from it.

---

## Root cause for each observed issue

### iPhone — timer stuck at 00:00, no controls / no way back
`useCoachedWorkout` gated `controller.start()` on `media.unlock().finally(...)`. On
iOS, `AudioContext.resume()` outside a fresh user gesture returns a promise that can
stay **pending indefinitely**, so `.finally()` never fired → the engine never
started → the timer stayed at 00:00, the phase stayed `idle`, and (because the
redesigned `Controls` render nothing when neither active nor paused) there was **no
pause/quit affordance**. One broken promise cascaded into all three symptoms.

**Fix:** start the engine **unconditionally**; unlock audio best-effort in parallel.
The Media Runtime already re-attempts unlock on `WORKOUT_STARTED` and arms a one-shot
gesture-unlock, so audio still comes up promptly — but the workout never waits on it.

### iPhone — Start button not visible
Two iOS layout gaps: (1) `min-height: 100svh` had **no `vh` fallback**; (2) the
Workout Detail's **fixed bottom Start bar** had no `safe-area-inset-bottom`, so it sat
under the home indicator / dynamic toolbar.

**Fix:** `min-height: 100vh` fallback before `100svh` (`.screen`, `.page-shell`,
`.workout-canvas`); the fixed Start bar now pads `max(env(safe-area-inset-bottom), 1rem)`.

### Mac Chrome — workout runs, coach silent
Classic Chrome `speechSynthesis` divergence from Safari: Chrome (a) enumerates voices
**asynchronously** (`getVoices()` is empty until `voiceschanged`, whereas Safari is
synchronous) and (b) intermittently **suspends** the synthesis queue, leaving speech
silent. Safari worked; Chrome didn't.

**Fix:** a `resume()` nudge after every `speak()` (no-op elsewhere, un-sticks Chrome),
and a gesture-time `SpeechService.warm()` (refresh voices + resume) called from
`MediaRuntime.unlock()`. The **dev diagnostics overlay** was added to confirm the exact
state on-device (voice count, selected voice, AudioContext state, unlocked, etc.).

---

## Files changed

- `hooks/useCoachedWorkout.ts` — start the engine unconditionally; expose `getMediaDiagnostics`.
- `app/globals.css` — `100vh` fallback before `100svh` (×3).
- `components/WorkoutDetail/WorkoutDetail.tsx` — safe-area-bottom on the fixed Start bar.
- `lib/speech/SpeechService.ts` — `resume()` nudge in `pump()`; `warm()`.
- `src/lib/media/SpeechManager.ts` — `warm()`, `voiceCount()`, `selectedVoice()`; `SpeechEngine` gains optional `warm`/`getSelectedVoice`.
- `src/lib/media/MediaRuntime.ts` — `unlock()` warms speech; `diagnostics()` live-composes audio/voice state.
- `src/lib/media/MediaDiagnostics.ts` — `audioState`, `voiceCount`, `selectedVoice`.
- `components/dev/WorkoutDiagnostics.tsx` (new) — dev-only overlay; `app/(routes)/workout/[id]/active/page.tsx` mounts it behind `NODE_ENV !== 'production'`.
- Tests: `SpeechService.test.ts` (+warm/nudge), `src/tests/media/runtime.test.ts` (+live diagnostics).

## Platform compatibility fixes

1. **Startup ordering** — engine start no longer depends on the audio-unlock promise.
2. **Viewport** — `svh` with a `vh` fallback; fixed bottom bars respect safe areas.
3. **Speech** — Chrome resume-nudge + gesture warm-up; graceful degradation unchanged.
4. **Diagnostics** — a dev overlay showing platform, capabilities, voices, selected
   voice, audio state, unlock/resume/autoplay counters, wake lock, and workout state.
   Verified **stripped from the production bundle**.

## Startup order (confirmed on every platform)

```
Press Start (gesture) → navigate → mount →  controller.start()  (engine runs, timer moves)
                                       └────  media.unlock() (parallel): warm speech + resume audio
WORKOUT_STARTED → MediaRuntime.begin(): resume audio, acquire wake lock, arm gesture fallback
ROUND_STARTED  → bell (once audio is running)      Coach Runtime → SpeechSink → speechSynthesis
```
Audio/bell may lag the very first moment on a locked context, but the workout and the
coach's speech never wait on it.

## Browser matrix

| | render | start (timer) | speech | bells | wake lock |
|---|---|---|---|---|---|
| Safari iOS | ✅ (svh+safe-area) | ✅ (unconditional start) | ✅ (gesture-warmed) | ✅ after unlock | ✅ (16.4+) |
| Chrome iOS (WebKit) | ✅ | ✅ | ✅ | ✅ after unlock | ✅ |
| Safari macOS | ✅ | ✅ | ✅ (already worked) | ✅ | ✅ |
| Chrome macOS | ✅ | ✅ | ✅ (resume-nudge + warm) | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ✅ | ⚠️ unsupported → graceful |

## Regression summary

231 tests pass (3 new), `tsc` clean (one pre-existing unrelated error), production
build succeeds, dev overlay confirmed absent from `.next/static`. Engine, Event
Runtime, Coach Runtime, and Session Runtime untouched; changes are confined to the
startup wiring, the Media Runtime, the speech stack, viewport CSS, and a dev-only tool.

## Remaining known issues

- **On-device confirmation of the Chrome speech fix** is pending a real device — the
  resume-nudge + warm are the well-documented fixes, and the diagnostics overlay will
  confirm (`voices:N`, `audio:running`) or point to a residual (e.g. persistent
  `voices:0` would indicate voices never load and a voice-ready gate is needed).
- **iOS lock-screen audio** (screen fully off) is still a platform limitation — the
  wake lock covers screen-on use; sustained background audio needs a MediaSession
  follow-up (tracked since PR-010).
- **Firefox wake lock** is unsupported; the screen may dim. Handled gracefully.
