# PR-031 — Opening Bell & Grace Period (Presence Completion)

Shipped the two things UAT asked for after PR-030: **room to arrive**, and a **real
boxing bell**. Both by adding almost nothing and touching no runtime ownership.

> The workout should not begin when the athlete presses START. It should begin when the
> athlete is ready to box.

## What shipped

### 1. Grace period — `hooks/useCoachedWorkout.ts`
After START, the hook unlocks audio and waits **15 s of silence**, then calls
`controller.start()`. Nothing is timed, spoken, or counted during the grace.

```
START → media.unlock() → setTimeout(15s) → controller.start()  // t = 0
```

- **The Engine never learns the grace existed.** No preparation phase, event, state, or
  timer abstraction. Its first truth is still `ROUND_STARTED` — the opening bell — at
  `t=0`. The grace lives entirely at the app/host start-sequence edge (the exact seam
  where `start()` was already called), as recommended in
  [PREPARATION_AND_THE_BELL.md](./PREPARATION_AND_THE_BELL.md).
- **StrictMode-safe:** the 15 s timer is cleared in effect cleanup, so the dev
  double-mount can't double-start.
- **A calm prep view** (`active/page.tsx`, gated on the new `isPreparing` flag) replaces
  what would otherwise be a frozen `00:00`: *"Get ready — put your phone down, wear your
  gloves, take your stance. The bell starts your first round."* No timer, no countdown,
  no coaching. The Leave guard stays active.

### 2. One real boxing bell — `src/lib/media/AudioManager.ts`
Replaced the synthesized sine "beep" with the provided **`public/boxing-bell.mp3`**,
played through the existing AudioContext:

- Fetched + `decodeAudioData` **once** on unlock (cached; failure ⇒ silent, never a
  blocker), then fired via `createBufferSource()`.
- **Strike count carries meaning, not pitch:** `round-start` = **1** strike (BEGIN),
  `rest-start` = **1** (the round-end bell — the same universal bell), `finish` = **3**
  (ding-ding-ding, STOP). Spacing `FINISH_STRIKE_GAP_SEC = 0.55`.
- **One asset, one bell.** No warning bell (removed the dead `'warning'` kind), no
  personalities, no per-product bells, no second system. Injectable loader
  (`bellAssetLoader`) keeps the layer headless-testable.

The event→bell mapping in `MediaRuntime.onEvent` is unchanged; only the *sound* changed.

## Verification (against the PR's four criteria)

1. **Room to arrive** — 15 s of silence + a prep view before the first bell; audio is
   unlocked during the grace so the opening bell is audible. ✓
2. **The opening bell is `t=0`** — the engine starts only after the grace, and its first
   event (`ROUND_STARTED`, no warmup in seeded workouts) rings the opening bell. The
   Engine remains unaware of everything before it. ✓
3. **Sounds like boxing** — plays the real `boxing-bell.mp3`, not an oscillator. ✓
4. **One bell** — a single asset, single `AudioManager`, strike-count semantics; no
   personalities or systems. ✓

## Tests
- `managers.test.ts` — begin = 1 strike, `finish` = 3 (ding-ding-ding), decoded once,
  silent while locked / unsupported.
- `runtime.test.ts` — transitions ring one strike; finish ≥ 3; bells respect the toggle;
  full workout still coached with no counting (PR-030 intact).
- `fakes.ts` — `FakeAudioContext` now models `decodeAudioData` + `createBufferSource`
  (tracks every strike as a `bufferSource`).

302 tests pass, tsc clean, `next build` green.

## Boundaries honoured
No new runtime, no Preparation phase/event/state, no Engine/Media/Coach ownership change,
no transitions redesign. The grace is a `setTimeout` at the edge; the bell is one asset
through the existing audio path. Smaller software, better boxing.
