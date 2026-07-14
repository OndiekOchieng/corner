# PR-029A — Session Introduction Investigation

**Investigation only. No fixes, no architecture changes.** One question:

> **Why was the introduction produced twice?**

---

## Answer (up front)

**The introduction is produced twice because `controller.start()` lives inside the
build `useEffect`, and React StrictMode (development only) intentionally runs that
effect twice — mount → cleanup → mount.** Each mount constructs a *fresh*
`MediaRuntime → SpeechManager → SpeechService` (that is the `#1 → #2`, `#3 → #4`,
`#5 → #6` pairing) and emits its own `WORKOUT_STARTED`, so the Session Introduction
is produced once per instance = twice.

It is **not** the coach speaking twice, **not** the engine looping, **not** a route
mounting twice. It is exactly one thing: **StrictMode's expected
dispose/rebuild cycle, applied to an effect that also starts the workout.**

**Is it actually *spoken* twice?** It depends on the voice-readiness gate:

| Condition at mount | Gate | Instance #1's intro | Heard |
|---|---|---|---|
| A specific voice is selected **and** voices not yet loaded (cold first load) | **holds** | sits in the in-memory queue, never dispatched; `dispose()` drops it | **once** |
| Browser-default voice, **or** voices already loaded (warm — every later start) | **open** | dispatched to `speechSynthesis.speak()` synchronously, and teardown never cancels it | **twice** |

So: **always produced twice; spoken once only in the narrow cold-load + specific-voice
case; otherwise spoken twice.** These are the two different bugs the PR distinguishes —
and the codebase currently sits on the boundary between them by design (see
[§ Spoken once or twice](#5-spoken-once-or-twice-the-most-important-question)).

Everything below is dev-only. **In production StrictMode does not double-invoke, so
there is exactly one instance, one `start()`, one produce, one utterance.**

---

## 1. Ownership — who constructs what

```
useCoachedWorkout (hooks/useCoachedWorkout.ts)
  └─ useEffect([workout.id])                         ← StrictMode double-invokes THIS
       ├─ new MediaRuntime()                         (media)
       │     └─ new SpeechManager(resolveSpeechEngine())
       │           └─ new SpeechService()  ── readonly instanceId = ++instanceCounter   ← the "#N"
       ├─ createCoachRuntimePlugin({ sink: media.speechSink() })   (coach)
       ├─ createHostRuntime(config, { subscribers:[coach, media] })(engine + bus)
       ├─ runtime.controller.start()   ←── emits WORKOUT_STARTED  (line 192)
       └─ return () => { runtime.dispose(); media.dispose() }      (cleanup, line 195)
```

The instance number is a **module-level counter** in `lib/speech/SpeechService.ts`:

```
let instanceCounter = 0;              // module scope — monotonic across the whole page
readonly instanceId = ++instanceCounter;   // one bump per SpeechService constructed
```

Every `new MediaRuntime()` builds exactly one new `SpeechService`, so **each effect run
bumps the counter by one**. Two runs per workout start ⇒ the pairs `#1 #2 / #3 #4 / #5 #6`.
`#1` is the disposed throwaway; `#2` is the survivor — the arrow `#1 → #2` is
`dispose(#1)` then `build(#2)`.

---

## 2. Which of the four hypotheses is true

| Hypothesis | Verdict | Evidence |
|---|---|---|
| The coach speaks twice | Partly — it **produces** the intro twice, but that's downstream | one `speak()` per `WORKOUT_STARTED`; there are two `WORKOUT_STARTED` |
| The workout starts twice | **Yes** | `controller.start()` is inside the double-invoked effect (`useCoachedWorkout.ts:192`) |
| The media runtime is rebuilt twice | **Yes** | `new MediaRuntime()` runs per effect run (`:132`) → fresh `SpeechService` each time |
| StrictMode dispose/rebuild | **Yes — this is the root** | all of the above are consequences of StrictMode's mount→unmount→mount in dev |

They are not four competing causes — they are one cause (StrictMode) seen at four
layers. The effect **both builds the runtime and starts the workout**, so a single
StrictMode remount rebuilds the media stack *and* re-fires `WORKOUT_STARTED`.

---

## 3. The complete lifecycle (the requested chain, annotated)

```
START BUTTON  ─ user taps Start on the pre-workout screen
     ↓
route transition ─ navigates to /workout/[id]/active
     ↓
mount ─ active page renders <WorkoutScreen/>, calls useCoachedWorkout(workout, settings)
     ↓
useCoachedWorkout ─ useEffect([workout.id]) fires        ★ StrictMode will run this twice
     ↓
MediaRuntime ─ new MediaRuntime()            (useCoachedWorkout.ts:132)
     ↓
SpeechManager ─ new SpeechManager(engine)    (MediaRuntime.ts:89)  instanceId = ++managerCounter
     ↓
SpeechService ─ new SpeechService()          (MediaRuntime.ts:84)  instanceId = ++instanceCounter  ← #N
     ↓
WORKOUT_STARTED ─ runtime.controller.start() (useCoachedWorkout.ts:192) → EngineController.forward → eventBus.publishAll
     ↓
CoachDirector ─ receives WORKOUT_STARTED → directs an `introduction` intent
     ↓
Session Introduction ─ SpeechPlanner.composeIntroduction() → "Good evening. …"
     ↓
speech queued ─ sink.speak(text) → SpeechManager.sink().speak → SpeechService.speak() (line 313)
                 → queue.push(utterance); pump()                      ← PRODUCED (trace: "#N speak() queued")
     ↓
dispose?  ─ StrictMode cleanup: runtime.dispose() then media.dispose()  (useCoachedWorkout.ts:195)
            runtime.dispose → controller.dispose() = loop.stop()+listeners.clear()  (EngineController.ts:108)
                              ↳ NO engine.cancel(), NO WORKOUT_CANCELLED, NO sink.cancel()
            media.dispose → speech.dispose() → SpeechService.dispose()  (line 372)
                              ↳ detaches this.current callbacks, drops queue,
                                 **intentionally NO speechSynthesis.cancel()**
     ↓
rebuild?  ─ StrictMode setup #2: new MediaRuntime() → new SpeechService() (#N+1), start() again
     ↓
speech queued again? ─ YES. Instance #N+1 runs WORKOUT_STARTED → intro → speak()  ← PRODUCED AGAIN
     ↓
ONSTART   ─ fires for #N+1's utterance only (its callbacks are intact).
            #N's utterance, if it was dispatched, plays with a *nulled* onstart (see §5).
```

**Where the second introduction originates:** `useCoachedWorkout.ts:192` —
`runtime.controller.start()` executed a second time by StrictMode's second effect
setup, on a brand-new `SpeechService` (`#N+1`). The coach code is innocent; it
faithfully produces one intro per `WORKOUT_STARTED` and simply receives two of them.

---

## 4. Sequence trace (StrictMode, dev)

```
── effect setup #1 ──────────────────────────────────────────────
  new SpeechService()                     → instanceId #1
  controller.start()                      → WORKOUT_STARTED (seq 1)
  Coach → intro "Good evening. …"
  SpeechService#1.speak()                 → [trace] #1 speak() queued
  pump():
     gate OPEN  (default/warm voice)      → SpeechService#1.synth.speak()   [trace] #1 synth.speak()
     gate HOLDS (specific voice, cold)    → held in #1.queue, 800ms timer armed  (no dispatch)
  void media.unlock() → speech.warm() → synth.resume()   (no cancel)
── effect cleanup #1 ────────────────────────────────────────────
  runtime.dispose()  → loop.stop(); listeners.clear()     (no cancel, no event)
  media.dispose()    → SpeechService#1.dispose():
                         current.onstart/onend/onerror = null
                         queue = []
                         **no synth.cancel()**
── effect setup #2 ──────────────────────────────────────────────
  new SpeechService()                     → instanceId #2
  controller.start()                      → WORKOUT_STARTED (seq 1, fresh engine)
  Coach → intro "Good evening. …"
  SpeechService#2.speak()                 → [trace] #2 speak() queued
  pump() → SpeechService#2.synth.speak()  → [trace] #2 synth.speak()
  onstart → [trace] #2 utterance ONSTART: "Good evening. …"
─────────────────────────────────────────────────────────────────
Net: 2 × "speak() queued".  synth.speak() calls = 1 (gate held #1) or 2 (gate open #1).
```

---

## 5. Spoken once or twice — the most important question

The intro is the **first** utterance of the session, so it passes through the
voice-readiness gate (`gatingFirstUtterance()` → `voiceReady()`), `SpeechService.ts:420/551`:

```
voiceReady() is TRUE (gate OPEN, dispatch synchronously) when:
   • no specific voice requested  (browser default)          ← default install
   • the requested voice already resolved
   • voices already loaded         (warm — any 2nd+ start on the page)
   • the session voice is already locked
voiceReady() is FALSE (gate HOLDS) ONLY when:
   • a specific voiceURI is pending AND voices haven't loaded yet   (cold first load only)
```

Two outcomes:

**A. Gate holds (cold first load + a non-default voice selected).** Instance #1's intro
never leaves `SpeechService#1.queue` — it is waiting for the voice. `dispose()` runs
first and drops the queue. Nothing was handed to the browser. Only instance #2 later
releases and dispatches. → **Spoken once.** (This is the case the `dispose()`
doc-comment was written for.)

**B. Gate open (browser-default voice, OR voices already warm — the common path).**
Instance #1 dispatches `speechSynthesis.speak(utterance#1)` **synchronously inside
setup #1**. Then:
- `runtime.dispose()` does **not** cancel (EngineController.dispose only stops the loop),
- `SpeechService#1.dispose()` **deliberately does not** call `speechSynthesis.cancel()`
  (its doc-comment: cancelling the *global* synth while disposing one instance was the
  old "StrictMode build→dispose→build **silence**" bug — they removed the cancel to fix it),
- nothing else cancels.

So `utterance#1` remains in the browser's **global** `speechSynthesis` queue. Instance
#2 then dispatches `utterance#2`. The browser now owns both and plays them in
sequence. → **"Good evening…" is spoken twice.**

### The instrumentation trap

`dispose()` sets `this.current.onstart = null` on instance #1's in-flight utterance.
So in case **B** the browser still *vocalizes* `utterance#1`, but its `ONSTART` trace
was detached — the dev log shows **one** `ONSTART` (#2's) even though **two**
`synth.speak()` calls reached the browser. **You cannot conclude "spoken once" from a
single ONSTART line.** The reliable evidence is the count of `#N synth.speak()` traces
(and `stats().synthSpeakCalls` summed across live instances), not `ONSTART`.

**Conclusion for #5:** produced twice always; the *audible* count is governed by the
gate. The previous fix (removing `synth.cancel()` from `dispose()`) traded a
StrictMode **silence** bug for a StrictMode **double-speak** bug in the default-voice
path. Both are dev-only.

---

## 6. Production vs development

| Trigger | Environment | Rebuilds? | Intro produced | Intro heard |
|---|---|---|---|---|
| **React StrictMode** | development | yes — mount→cleanup→mount | **twice** | once (gate held) or **twice** (gate open) |
| **Hot Reload / Fast Refresh** | development | yes — on file save it re-runs the effect | again per save | same gate rule; independent of StrictMode |
| Normal mount | **production** | **no** | **once** | **once** |

- The reported clean `#1→#2 / #3→#4 / #5→#6` pairing is the **StrictMode** signature
  (each workout start = exactly one dispose+rebuild pair).
- **Hot Reload** would produce the same rebuild but at *edit* time and irregularly — it
  is a second dev-only trigger, not the cause of the reported pairs.
- **Production build (`next build && next start`)** strips StrictMode's double-invoke:
  one effect run, one `SpeechService`, one `WORKOUT_STARTED`, one intro. Not a
  production bug.

`reactStrictMode` is not set in `next.config.mjs`, and the Next.js App Router defaults
it to `true`, so StrictMode is active in `next dev`.

---

## Root cause (one sentence)

> The build `useEffect` in `useCoachedWorkout` both **constructs the media stack** and
> **calls `controller.start()`**, so React StrictMode's expected dev-only mount →
> cleanup → mount runs the constructor and `WORKOUT_STARTED` twice, producing the
> Session Introduction once per `SpeechService` instance (`#1` then `#2`).

Whether that second production is *also heard* is decided separately by the
voice-readiness gate and by `dispose()`'s intentional refusal to cancel the shared
`speechSynthesis` — audible in the default-voice / warm-voice path, silent in the
cold-load + specific-voice path.

**No fix proposed here — investigation only.**
