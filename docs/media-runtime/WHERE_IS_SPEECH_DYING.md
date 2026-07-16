# PR-030A — Where Is Speech Dying?

**Investigation only. No fixes. PR-030 not reverted.** The question is not "why is the
coach mute" — it is "where did a spoken utterance stop existing?"

---

## Verdict (up front)

| Layer | Verdict | Evidence |
|---|---|---|
| **Browser (Web Speech engine)** | **GUILTY** — this is where speech dies | `synth.speak()` accepted (`speaking=true`) but `onstart` never fired; the utterance was never vocalised |
| Watchdog | **Witness, not killer** | the 5 s timer *observed* the browser's silence and then `cancel()`-ed to clean up — it fires *after* the browser already failed to start |
| Coach Runtime / CoachDirector | **INNOCENT** — not even in the code path | the evidence comes from a raw-synth probe that never runs coach code |
| Production `SpeechService` | **INNOCENT — not in the path** | the probe calls `window.speechSynthesis` directly, bypassing the wrapper (and its mitigations) |
| Queueing (coach queue) | **INNOCENT** | `pending=false` throughout — nothing was ever in a coach queue on this path |
| **PR-030** | **INNOCENT** | its only change is in `CoachDirector`; the evidence path executes zero coach code — reverting it cannot change a raw `speechSynthesis.speak()` result |

**Where speech died:** *after* `synth.speak()`, *before* `onstart` — inside the browser's
speech engine. Every other layer is upstream of, or a witness to, that death.

---

## The single most important finding

**The evidence is not from a workout. It is from the dev speech sandbox.**

The log lines in the report — `BEFORE speak() → pending=… speaking=…`,
`AFTER speak() → …`, `NO onstart in 5000ms — utterance SILENTLY DROPPED`, `canceled`,
`voice=DEFAULT`, `voiceschanged (199 voices)` — are emitted **verbatim** by
`app/dev/speech/SpeechSandbox.tsx` (a `/dev/speech` route), and by nothing else in the
codebase.

That harness (lines 160–232) does this:

```ts
const s = window.speechSynthesis;                 // ← the RAW browser global
const u = new SpeechSynthesisUtterance(opts.text) // ← a RAW utterance
…
addLog(`BEFORE speak() → pending=${!!s.pending} speaking=${!!s.speaking} …`)
s.speak(u);                                        // ← RAW browser call
addLog(`AFTER speak()  → …`)
timer = setTimeout(() => {                         // ← the "watchdog" (sandbox-only)
  if (!started) { addLog('NO onstart … SILENTLY DROPPED'); s.cancel(); }
}, STALL_TIMEOUT_MS /* = 5000 */)
```

It **bypasses the entire pipeline**: no `CoachDirector`, no `CoachRuntime`, no
`SilenceController`, no `QueueManager`, no `MediaRuntime`, no `SpeechManager`, and **not
even the production `SpeechService` class**. It is a deliberately isolated probe of the
browser boundary. So the evidence proves something about the **browser**, and, by
construction, *nothing* about the coach.

A grep for the watchdog confirms it is dev-only: `STALL_TIMEOUT_MS`/`SILENTLY DROPPED`
exist only in `SpeechSandbox.tsx`. **The live workout path has no 5 s stall-cancel at
all** (the only `5000` in coaching is `minCoachingGapMs`, a silence-spacing constant).
So the phrase "watchdog → dropped → canceled" can *only* originate from the sandbox — a
real coached session cannot produce it.

---

## Timelines

### Event timeline (what the sandbox did)

```
t=0       user clicks a "speak" button in /dev/speech        (user gesture present)
t=0       voiceschanged → 199 voices loaded                  (voices are READY)
t=0       BEFORE speak(): pending=false speaking=false paused=false
t=0       s.speak(u)  — u.voice = DEFAULT (none assigned), rate=1 pitch=1 vol=1
t=0+ε     AFTER speak(): pending=false speaking=true paused=false   ← browser ACCEPTED it
t=0..5s   (waiting) — onstart never fires
t=5s      watchdog: "NO onstart in 5000ms — SILENTLY DROPPED"; s.cancel()
```

### Speech timeline (browser-boundary counters, mapped to SpeechService semantics)

```
speakCalls        1     ← speak() entered
synthSpeakCalls   1     ← synth.speak() was reached  (death is AFTER this)
onstart           0     ← browser never began        ← the utterance dies HERE
onend             0
onerror           0     ← not even an error was raised — a *silent* stall
queueLength       0     ← pending=false: nothing queued behind it
```

This is the exact signature the production `SpeechService` was instrumented to catch —
its own comment: *"this is where 'speak() called but nothing heard' is proven: synth.speak
fires but onstart never does."* The boundary behaved as designed; the browser did not.

### Queue timeline

```
coach queue:   ∅  (never used on this path)
browser queue: [u] accepted → held "speaking" → never started → cancel() clears it
```

### Watchdog timeline

```
armed at speak()  ──▶  5s of browser silence  ──▶  fires  ──▶  logs "DROPPED"  ──▶  cancel()
                        (the browser had already failed to start well before this)
```

The watchdog does not *cause* the death; it *reveals* it. Remove the watchdog and the
utterance is still silent — you would simply never be told.

---

## Answers to the eight questions

**1. Did CoachDirector produce coaching?** Not on this evidence path — CoachDirector isn't
invoked by the sandbox. (Separately, on the *live* path it demonstrably produces: the
PR-030 transcript showed 12 lines; unit/integration tests assert intro + round intros +
coaching.) The captured failure is **not** a "coach produced nothing" failure.

**2. Did CoachRuntime attempt speech?** Not on this path (`produced`/`spoken`/`discarded`
are CoachRuntime diagnostics; the sandbox never constructs a CoachRuntime). The
produced-vs-spoken-vs-discarded distinction does not apply to raw-synth evidence.

**3. Inside SpeechService — before/after PR-030?** The probe doesn't use `SpeechService`,
but mapping the evidence onto its counters: `speakCalls=1, synthSpeakCalls=1, onstart=0,
onend=0, onerror=0, queueLength=0`. **PR-030 changed none of these** — it touches only
`CoachDirector`. Before and after PR-030 these counters are identical, because PR-030 is
not on this code path.

**4. Before or after `synth.speak()`?** **After.** `speaking=true` proves dispatch
succeeded; `onstart=0` proves vocalisation never began. Death is `speak() → synth.speak()
→ (nothing)` — the browser accepted and then stalled.

**5. The watchdog.** It is the sandbox's `STALL_TIMEOUT_MS` (5 s) diagnostic. *What
cancelled it?* the sandbox's `s.cancel()`. *Why?* `!started` — no `onstart` in 5 s. *Was
it speaking?* only per the API flag (`speaking=true`), never audibly. *Pending?* no
(`pending=false`). *Expired?* no — there is no engine/queue expiry on this path. *Waiting?*
yes — waiting on an `onstart` the browser never sent. It is a **diagnostic that makes a
silent browser stall visible**, not a production mechanism.

**6. Is PR-030 involved?** **No — provably.** The evidence executes a raw
`speechSynthesis.speak()` with zero coach code in the stack. *Revert prediction:* revert
PR-030 → **the stall persists** (it is a browser-boundary failure independent of the
coach) → therefore, per the PR's own rule, **PR-030 is innocent.** Speech did not begin
dying at `COUNTDOWN_SECOND`, `ROUND_STARTED`, or `introduction` — none of those run here.
It dies at `window.speechSynthesis.speak()`.

**7. Cross-platform.** Cannot execute browsers in this environment; this needs on-device
confirmation via the same `/dev/speech` page. Reasoned expectation for the
"accepted-but-no-`onstart`" stall, given *voices are loaded (199)* and a *gesture is
present*:

| Platform | Likely | Leading cause |
|---|---|---|
| Chrome macOS/Android | **reproduces intermittently** | Blink's "speechSynthesis starts paused/stuck" bug — needs a `resume()` nudge the raw probe doesn't do |
| Safari macOS | usually OK | WebKit generally starts promptly once voices exist |
| Safari iPhone | gesture-sensitive | needs the utterance within/near a user gesture; background/route timing can stall |
| Chrome iPhone (WebKit) | most fragile | inherits WebKit + Chrome-iOS integration quirks (see [WAKE_LOCK.md](./WAKE_LOCK.md)) |
| production vs development | **same** at the browser boundary | this failure is below the app; build mode doesn't change `speechSynthesis` |

**8. New, or an existing class?** **Existing, well-known class.** "Silent drop:
`synth.speak()` accepted, `onstart` never fires" is precisely what the `SpeechService`
boundary counters + `ONSTART/ONEND/ONERROR` traces were built to detect. It sits in the
same family as: voice-readiness gating (PR-020A), the StrictMode dispose/cancel silence
(PR-029A), the audio-unlock / user-gesture requirement (PR-025), and the platform
rate/WPM differences (PR-024). It is **not** a new coach/runtime regression.

---

## Why the sandbox is *more* prone to this than the live coach

Important caveat against concluding "the coach is mute." The raw probe lacks two
mitigations the production `SpeechService` applies:

- **Post-dispatch resume nudge** — `pump()` runs `if (this.synth.paused) this.synth.resume()`
  right after `synth.speak()` (SpeechService.ts:493), directly countering Chrome's
  stuck-paused bug. The sandbox probe does **not** nudge (its `resume()` is a separate
  manual button).
- **Gesture warm** — `warm()` calls `synth.resume()` on unlock (SpeechService.ts:501-505).

So a stall in the raw sandbox does **not** prove the live coach stalls identically — the
live path has counter-measures the probe deliberately omits (it is testing the *bare*
boundary). This is consistent with the PR's warning: do not assume the coach is mute.

---

## Root cause

> A raw `window.speechSynthesis.speak(utterance)` was **accepted** by the browser
> (state advanced `speaking=false → true`) but the browser's speech engine **never fired
> `onstart` and never produced audio**. Five seconds later the *sandbox's own diagnostic
> watchdog* logged "SILENTLY DROPPED" and called `cancel()` to reset for the next probe.
>
> **Speech died inside the browser, after `synth.speak()` and before `onstart`.** The
> Coach Runtime, the production SpeechService, the coach queue, and PR-030 are all either
> outside this code path or upstream of the failure. The layer that owns the failure is
> the **Browser**; the watchdog is only its witness.

The signature (voices loaded, gesture present, no error, no `onstart`, raw probe without a
`resume()` nudge) most strongly implicates the **Chrome `speechSynthesis` stuck/paused
engine bug** — which the production path already nudges against and the sandbox does not.

*No code changed. Next step, if desired: reproduce on-device via `/dev/speech` per the §7
matrix to confirm the platform, then decide (separately) whether the raw probe should
adopt the production resume-nudge so the sandbox measures the same boundary the coach
does.*
