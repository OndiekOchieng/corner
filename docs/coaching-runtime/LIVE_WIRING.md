# Live Wiring — The Coaching Experience, Observable

This PR connects the completed platform to the live app so a real athlete hears
the designed coaching for the first time. The whole stack now drives an actual
workout:

```
Execution Engine → Host Runtime → Event Runtime → Coach Runtime → SpeechService
        (time)        (RAF loop)     (EventBus)      (judgement)     (voice)
```

No engine, host, event-runtime, session, speech, or coaching-logic changes — only
composition and the removal of the old paths.

---

## What was wired

- **`hooks/useCoachedWorkout.ts`** — the composition root. On mount it builds a
  `SpeechService`, registers a `CoachRuntimePlugin` (with the selected personality)
  and an `AudioBellSubscriber` on the Host Runtime's EventBus, maps the app
  `Workout` → engine `WorkoutConfig`, and `start()`s. The UI renders from engine
  snapshots via `useSyncExternalStore`; pause/resume/quit forward `WORKOUT_*`
  events, which the Coach Runtime turns into `sink.pause/resume/cancel` — so speech
  control is entirely event-driven, never manual.
- **`src/lib/integration/workout-config.ts`** — `toWorkoutConfig()` maps the app's
  seconds-based `Workout` to the engine's integer-ms `WorkoutConfig`, normalising
  cue times to be strictly increasing and inside the round so the Timeline never
  rejects them.
- **`src/lib/integration/AudioBellSubscriber.ts`** — plays the existing Web Audio
  bells (round/rest/finish) as a plain event `Subscriber`, gated by the "Bell
  sounds" preference.
- **Coach selection → Coach Packs.** `UserPreferences.coachPack` (default *Fight
  Night*) is chosen in Settings ("Your coach") and passed straight through as the
  Coach Runtime `personality`. The same workout is now a different session per
  coach — live.
- **`app/(routes)/workout/[id]/active/page.tsx`** — rewritten to render the engine
  snapshot (phase → work/rest, `roundNumber`, `remainingSeconds`) and route to the
  summary on `finished`.

## What was removed (obsolete / duplicate coaching)

The active page previously ran **two** coaching paths at once: the legacy
`useWorkoutEngine` (a RAF timer that spoke `"Round N"` itself via `useSpeech`) and
a separate `CoachEngine` polled every render. Both are gone:

- Deleted `hooks/useWorkoutEngine.ts`, `hooks/useRAFTimer.ts`, `hooks/useSpeech.ts`
  (now unreferenced).
- Removed the per-tick `coach.handleCues/handleCountdown/...` polling and the ad-hoc
  bell effects from the active page.

The PR-001 `CoachEngine`/`SpeechService` remain (SpeechService renders the actions;
CoachEngine is still used by Settings for the voice list) — the speech stack is
reused, not rewritten.

## Boundaries preserved

- The **Coach Runtime** stays pure/deterministic: its only imports are *type-only*
  `WorkoutEvent`/`Subscriber`. No browser, React, RNG, or wall-clock.
- The **engine** is untouched; the app meets it only through `toWorkoutConfig` and
  read-only snapshots.
- Speech is reached solely through the `SpeechSink` port (`speechServiceSink`) — the
  SpeechService is neither bypassed nor modified.
- Bells and coaching are independent subscribers; neither knows about the other.

## How to verify

- **Headless (CI):** `src/tests/integration/liveWiring.test.ts` runs the exact app
  path (mapper → engine → EventBus → CoachRuntimePlugin + AudioBellSubscriber) on a
  real seeded workout with a spy sink — asserting a coached session, wired bells,
  per-coach difference, and determinism. 185 tests pass; `tsc`/`build` clean.
- **In a browser:** start any workout → hear the workout intro, round intros,
  authored cues, exact countdown, rest coaching, and an honest close; change the
  coach in Settings and the same workout feels different; pause silences the coach,
  resume continues without replay.

## Known follow-ups (carried from PR-009 risks)

- Background-audio / lock-screen robustness (speech with the screen off) — the
  biggest pre-Beta item.
- History persistence still not wired (PR-008 risk R1); the finish summary passes
  data via query params.
- Coach change takes effect on the next workout (personality is fixed at start),
  which is the intended UX.
