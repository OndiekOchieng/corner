# PR-014 — Speech Pipeline Trace & Root Cause

Chrome Android reports everything healthy (AudioContext running, media unlocked,
199 voices, speech ready) yet the athlete hears nothing. This traces ONE coaching
line from `WORKOUT_STARTED` to `speechSynthesis.speak()` / `onstart` and pins the
exact boundary — with instrumentation, not guesswork.

---

## Instrumentation added (dev-only, stripped from production)

Every boundary now reports counters that make the trace conclusive on-device:

- **Coach Runtime** — `actionsGenerated` / `actionsSpoken` / `discarded` / queue depth (existing `CoachDiagnostics`, now surfaced).
- **SpeechService** — a stable `instanceId` and counters: `speakCalls`, `synthSpeakCalls`, `onstart`, `onend`, `onerror`, `queueLength`, `currentText`, `selectedVoice`. It logs the raw browser error payload. `stats()` exposes them.
- **SpeechManager** — a stable `instanceId`; passes the service id + stats through.
- **Dev overlay** — a `pipeline trace` panel showing all of the above, refreshed at 2 Hz.

Verified stripped from the production bundle (`.next/static/**/*.js` contains none
of the trace strings; only the cheap integer counters remain, and they are never
read in production).

## The trace (what the overlay shows)

Following the coaching line for `WORKOUT_STARTED`:

```
[Engine]         WORKOUT_STARTED emitted
[EventRuntime]   published to subscribers
[CoachRuntime]   coach: produced:1  spoken:1        ← Director→Planner→Queue→drain OK
[SpeechSink]     sink.speak("…")                    ← coach → SpeechManager sink OK
[SpeechService]  #1 speak() queued: "…"             ← enabled + supported OK
[SpeechService]  #1 synth.speak(): "…" (voice=…)    ← REACHED THE BROWSER
[SpeechService]  #1 utterance ONSTART: …            ← ⛔ never fires on Chrome Android
```

Overlay readout on the silent device:

```
coach     produced:1 spoken:1 q:0
service   #1 speak():1 → synth.speak():1
utterance onstart:0 onend:0 onerror:0 · qlen:0
ids       mgr#1 · svc#1 · speaking
```

Everything up to and including `speechSynthesis.speak()` runs. **`onstart`,
`onend`, and `onerror` all stay 0** — the browser accepts the call but never
starts (or errors) the utterance. That is the first broken boundary.

## Root cause

**The boundary is `speechSynthesis.speak()` → `onstart`.** On Chrome (especially
Android), `speechSynthesis` will only *start* an utterance if the FIRST speak of
the page is initiated by a **user gesture**. Corner is hands-free: the coach's
first line is emitted from an effect *after* navigation to the workout screen, with
no active user gesture — so Chrome silently withholds `onstart` and produces no
audio, while `speak()` itself "succeeds."

The healthy diagnostics are a red herring: voices / AudioContext / unlocked all
describe audio *capability*, not speech *activation* — which is a separate,
gesture-gated browser state that no capability flag reflects. (`synthSpeakCalls:1,
onstart:0` is precisely how the two diverge.)

Instance identity was ruled out along the way: the overlay shows a single
`SpeechService (#1)` and single `SpeechManager (#1)` — no duplicate, stale, or
misinjected instance; the coach's sink forwards to that one service.

## Fix applied

Grant speech activation **within the Start gesture**, before navigation, so the
same-document workout screen can speak. Added `primeSpeechFromGesture()` (media
layer) — a one-off **silent** primer through the global `speechSynthesis` — and
called it from the Workout Detail **Start** button's `onClick`. This flips Chrome's
one-time activation using the same `speechSynthesis` the SpeechService uses; it is
NOT a new speech implementation and does not replace the SpeechService.

Also hardened the PR-013 resume-nudge to fire **only when the queue is genuinely
suspended** (`if (synth.paused)`), removing any chance the unconditional
`resume()` interfered with a fresh utterance.

After the fix the trace should read `onstart:1` — confirmable live on the overlay.
If a device ever still shows `synth.speak():N, onstart:0`, the trace has already
localised it to the browser activation gate (next option: a visible "tap to enable
voice" affordance), not to any Corner layer.

## Files changed

- `lib/speech/SpeechService.ts` — instance id + boundary counters + `onstart` capture + `onerror` payload log + `stats()`; conditional resume-nudge; dev trace (stripped from prod).
- `src/lib/media/SpeechManager.ts` — instance id; `serviceId()` / `serviceStats()`; optional `stats`/`instanceId` on the `SpeechEngine` port.
- `src/lib/media/MediaRuntime.ts` — `speechTrace()`.
- `src/lib/media/prime.ts` (new) — `primeSpeechFromGesture()`; exported from the media index.
- `hooks/useCoachedWorkout.ts` — `getSpeechTrace()`; coach-plugin ref.
- `components/dev/WorkoutDiagnostics.tsx` — pipeline-trace panel.
- `components/WorkoutDetail/WorkoutDetail.tsx` — prime speech on the Start gesture.
- Tests: `SpeechService.test.ts` (stats/boundary counters), `src/tests/media/runtime.test.ts` (speech trace).

## Regression summary

235 tests pass (4 new), `tsc` clean, production build succeeds, and all dev
instrumentation (overlay + trace strings) is confirmed absent from the production
`.js`. Engine, Event Runtime, Coach Runtime, and Session Runtime are untouched; the
SpeechService is instrumented and hardened, not replaced.
