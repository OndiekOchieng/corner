# PR-033 — BEGIN NOW (Presence & Preparation)

> START means: *I intend to box.* BEGIN NOW means: *I am prepared.* The Bell means:
> *boxing begins now.*

A quiet escape hatch on the preparation screen for the athlete who has already arrived.
It is **not** the happy path — the primary experience is unchanged: press START, put the
phone down, wear the gloves, take a stance, and the bell rings on its own after the 15-second
grace. BEGIN NOW exists only for the case where preparation has already happened.

## What it is (and isn't)

- **Is:** one quiet button that ends the existing grace period early and rings the opening
  bell. It reuses the *exact same code path* the 15-second timer already takes.
- **Isn't:** a new preparation phase, engine state, workout state, runtime, or abstraction.
  The 15-second grace period is unchanged. The Engine is still never told the grace
  happened — from its side, the bell rang and t=0 began.

Implementation is deliberately boring: the grace timer's callback was extracted into a
single idempotent `begin()` function; the timer calls it after 15 s, and BEGIN NOW calls it
on tap. Whichever fires first wins; the other is a no-op.

```
useCoachedWorkout:
  let begun = false
  const begin = () => { if (begun) return; begun = true
                        clearTimeout(graceTimer); media.unlock(); // gesture → audible bell
                        setIsPreparing(false); controller.start() }  // → ROUND_STARTED → opening bell
  graceTimer = setTimeout(begin, 15_000)   // happy path
  beginNowRef.current = begin              // escape hatch → exposed as beginNow()
```

## The four questions

1. **Does BEGIN NOW immediately ring the bell?** **Yes.** It ends the grace and calls
   `controller.start()`, whose first event (`ROUND_STARTED`, no warmup in seeded workouts)
   rings the opening `boxing-bell.mp3`. One tap → bell → box. Because the tap is a user
   gesture, `begin()` also unlocks audio so the bell is heard.
2. **Should the remaining timer disappear?** There is **no visible timer or countdown**
   during preparation (PR-031 kept it silent — presence, not a clock). So there is nothing
   to hide, and BEGIN NOW introduces no countdown. It simply ends the calm prep screen and
   rings the bell.
3. **Should BEGIN NOW remain visible throughout preparation?** **Yes.** It lives in the
   preparation view for the whole grace period, so an athlete who is ready at any moment can
   tap it. It vanishes the instant boxing begins (the view is gated on `isPreparing`).
4. **Does it materially improve immersion?** **Yes, for the prepared athlete** — it removes
   a forced wait when they have already arrived — **without diluting the happy path**,
   because it is quiet and secondary. The athlete is never *required* to touch the phone
   after START; BEGIN NOW is offered, not demanded.

## Investigation notes

- **Copy:** "Begin now" — boring and unambiguous. The `aria-label` expands it to *"Begin
  now — ring the bell and start the first round."* START = *I am beginning this
  experience*; BEGIN NOW = *I have arrived.*
- **Placement & weight:** below the preparation copy, styled **quiet and secondary** — a
  bordered pill with muted text (not a filled, primary CTA). It is an escape hatch, so it
  must not compete with the calm of the room or imply the athlete *should* tap it.
- **Interaction:** a single tap → ends grace → unlocks audio (gesture) → opening bell →
  boxing. Idempotent: the shared `begin()` guard means BEGIN NOW and the 15-second timer can
  never both start the workout, and a second tap does nothing.
- **Countdown behaviour:** none. Preparation has no countdown (PR-030/031) and BEGIN NOW
  adds none. Software counts; a gym rings.
- **Accessibility:** a real `<button>` with a descriptive `aria-label`, a `min-h-12` (48 px)
  tap target, a visible `focus-visible` ring, and full keyboard activation.
- **Mobile:** 48 px+ tap target, centred and thumb-reachable, quiet styling that reads as
  optional.

## Philosophy check

- **Prefer removing over adding:** BEGIN NOW *removes* a forced wait for the prepared
  athlete; the only addition is one callback + one quiet button, both riding the existing
  grace path. No new abstractions.
- **Presence owns preparation:** the grace screen (Presence) still owns the room; BEGIN NOW
  is just the athlete telling Presence *"I've arrived."*
- **The Bell owns beginnings:** BEGIN NOW does not itself announce anything — it hands off to
  the bell, which owns the moment boxing begins.

## Verification

- **tsc clean**, **306 tests pass** (no regressions), **`next build` green.**
- No unit test is added: BEGIN NOW is React hook + view wiring, and the app has no
  DOM/component test harness (vitest runs in Node) — adding jsdom would be new
  infrastructure and out of scope, exactly as for the PR-031 grace period. The shared
  `begin()` path it rides is already exercised by the workout flow.
- **Manual QA matrix** (run on device):

  | Scenario | Expected |
  |---|---|
  | START → wait 15 s | bell rings automatically → boxing (happy path, unchanged) |
  | START → tap "Begin now" at ~3 s | bell rings immediately → boxing; no wait, no countdown |
  | Tap "Begin now" twice quickly | second tap is a no-op; workout starts once |
  | Tap "Begin now" just as the 15 s elapses | starts once (idempotent); no double bell |
  | Keyboard: Tab to "Begin now" → Enter | activates; focus ring visible |
  | Leave (back/quit) during preparation | still guarded; exits cleanly |
  | Audio locked before tap | the tap (a gesture) unlocks audio so the opening bell is heard |

Keep it beautifully boring.
