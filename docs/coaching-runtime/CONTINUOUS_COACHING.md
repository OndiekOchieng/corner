# INV-003 — Continuous Coaching

**Investigation only. No code, no fixes, no architecture.** One question:

> **Can Corner continuously coach an athlete's ears for 30 uninterrupted minutes?**

Speech, wake lock, Safari, and Chrome are not the subject — they are *participants* in that
one story. This synthesizes the prior investigations —
[COACH_CONTINUITY (INV-001)](COACH_CONTINUITY.md),
[WAKE_LOCK_AND_IMMERSION (INV-002)](../media-runtime/WAKE_LOCK_AND_IMMERSION.md),
[WHERE_IS_SPEECH_DYING (INV-029A)](../media-runtime/WHERE_IS_SPEECH_DYING.md),
[FLIGHT_RECORDER](../observability/FLIGHT_RECORDER.md) — into one answer.

---

## Verdict (up front)

**PARTIALLY — and, in part, we were asking the wrong question.**

Split the promise into its two halves, because they have different answers:

1. **"The Coach never stops coaching."** — **YES, always, on every platform.** Proven in
   INV-001: the Coach Runtime, its memory, timing, and the workout survive locks, visibility
   changes, and browser suspension untouched (they are ref-owned and never unmounted). The
   Coach continues from the correct wall-clock moment and **never restarts.** This half is not
   platform-conditional. It is simply true.
2. **"…in the athlete's *ears*, continuously, for 30 minutes."** — **conditional.** The ears
   receive the Coach only while the page stays **foregrounded and the screen awake**. Where the
   wake lock is honoured and the athlete keeps Corner in front (Chrome/Android, desktop, Safari
   iOS 16.4+), **yes — 30 uninterrupted minutes.** Where the wake lock is absent or ignored
   (iOS "Case C") or the athlete backgrounds the app, the screen sleeps → the page hides → the
   browser suspends audio → **the ears go quiet until the athlete returns.** The Coach never
   stopped; the *hearing* did.

**The wrong-question part:** we have been treating **one** problem (continuous coaching of the
ears) as **five** (speech, wake lock, visibility, Safari, Chrome). They are not five problems.
They are one causal chain with a single lever.

---

## The one chain (not five problems)

```
wake lock absent/ignored  ─┐
                           ├─►  VISIBILITY → hidden  ─►  browser suspends audio  ─►  ears quiet
athlete backgrounds app  ──┘         │
                                     └─►  wake lock auto-released (reacquired on return)

  … none of the above touches the COACH RUNTIME (memory · timing · judgment survive) …
```

Everything the athlete calls "the coach stopped" flows through **one hinge: visibility →
hidden.** Speech suspension is *downstream* of it. Wake lock is the *defense against* it
(keep the screen on → the page never hides). Safari and Chrome are merely *how each platform
implements* the suspend/resume. So the real, singular product question is:

> **Can Corner keep the athlete's page foregrounded and awake for 30 minutes, so the ears
> never lose the Coach?**

That is the wake-lock / foreground problem — one thing, not five.

**One genuinely separate thread:** speech can go unheard *without* any visibility change — the
Chrome `speechSynthesis` "accepted but never `onstart`" stall (WHERE_IS_SPEECH_DYING). But that
evidence came from the raw `/dev/speech` sandbox, which lacks the production SpeechService's
`resume()` nudge; the coach path mitigates it. So it is a *minor, mostly-mitigated* second
thread, not a co-equal problem.

---

## Continuous Coaching timeline

```
Opening bell (t=0)
   │  Coach coaches · silence is the default · ears hear (screen awake via wake lock)
   ▼
── screen stays awake (wake lock honoured, app foreground) ──►  ears continuous  →  SUCCESS
   │
   └─ OR screen sleeps (wake lock fails/ignored) / athlete backgrounds
        │  visibilitychange → hidden
        │     • EngineController: loop.pause() — ticking stops, WORKOUT KEEPS wall-clock time
        │     • browser: AudioContext suspended · wake lock released
        │     • Coach Runtime: UNTOUCHED (memory, timing, judgment intact)  ← never stops
        │  ears QUIET (audio suspended) — Coach still coaching, just unheard
        ▼
     athlete returns → visibilitychange → visible
        • EngineController.handleVisible: reconcile (fast-forward to now), loop.resume()
        • MediaRuntime.handleVisible: AudioContext.resume() + wakeLock.reacquireIfWanted()
        • stale coach lines EXPIRED (PR-021 TTL) → no replay storm; Coach speaks the NOW
        ▼
     ears resume  ──  IF audio actually resumes on this platform  ← the one "NO IDEA"
   │
   ▼
Final bell → complete
```

---

## Relationship diagram (§4)

```
                 Wake Lock ── keeps screen on ──► prevents ──┐
                                                              ▼
        athlete backgrounds ───────────────────►  VISIBILITY (the hinge)
                                                              │ hidden
                                        ┌─────────────────────┼─────────────────────┐
                                        ▼                     ▼                      ▼
                                 AudioContext           Wake Lock             (independent)
                                 suspended              auto-released         Chrome synth stall
                                 → ears quiet           → reacquire on         → mitigated by
                                        │                  return                 resume-nudge
                                        │
   ┌────────────────────────────────────┼──── none of this reaches ────────────────────┐
   ▼                                     ▼                                               │
COACH RUNTIME (memory · timing · judgment) — survives all of it, never stops, never restarts
   ▼
ATHLETE'S EARS ── hear only when audio is playing (screen on + not suspended)
```

**Answering the six relationship questions:**
1. **Speech unheard without visibility changing?** Yes — the Chrome synth stall (mitigated in
   the coach path, not the raw sandbox).
2. **Visibility change without speech unheard?** Yes — most visibility changes land during
   **silence** (Corner's default), so nothing audible is lost; and a change while idle costs
   the ears nothing.
3. **Wake lock fail while speech continues?** Yes — they are independent. Wake lock only
   matters because *screen-off → hidden → suspend*. If the screen stays on by other means,
   speech is fine (INV-002: a wake-lock failure never touches the coach/speech directly).
4. **Speech naturally recover?** Yes — `handleVisible` resumes the AudioContext and the Coach
   continues at the current moment. "Recovery" = *resume + continue*, never *restart*.
5. **Recover differently per platform?** Yes — iOS **freezes** JS entirely (page suspended) and
   may require a gesture for audio to resume; Chrome **throttles**; the resume-nudge helps
   Blink. Same mechanism (`handleVisible`), different reliability/latency (WHERE_IS_SPEECH_DYING
   matrix).
6. **Continuously coach despite interruptions?** The **Coach**: always. The **ears**: only if
   the interruption didn't background the page, or recovers instantly.

---

## What survives / sleeps / recovers (§2, §3)

| On a screen lock | Verdict |
|---|---|
| Coach Runtime · Coaching Memory · timing · workout state · Event Bus · Queue | **survive** (ref-owned, never unmounted) |
| The workout's progress | **survives** — wall time keeps elapsing; unlock fast-forwards |
| AudioContext / speech playback | **sleeps** (browser-suspended) → **recovers** on visible |
| Wake lock | **released** by the browser → **reacquired** on visible (if honoured) |
| Bell | survives; a bell during the lock window is inaudible (rare — bells fire on transitions) |

**Nothing dies. The Coach sleeps nothing — it keeps coaching. Only the *audio* sleeps.** The
"death" reported earlier (WHERE_IS_SPEECH_DYING) was the raw-synth sandbox at the browser
boundary, not the coach path.

---

## Where Continuous Coaching begins and ends (§1) + success criteria (§7)

Continuous Coaching runs **from the opening bell to the final bell**, and is defined at the
**athlete's** level, not the counter level:

- **SUCCESS** — the athlete **never had to touch the phone** to keep the Coach in their ears,
  and the Coach never restarted. *(30 min, no interruptions. Or: a brief audio sleep that
  self-recovered without the athlete doing anything. Or: wake lock failed but the screen stayed
  on and the Coach kept coaching.)*
- **PARTIAL** — a momentary hearing gap that **self-recovered** (a few quiet seconds on a lock,
  then resumed) with no athlete action; the Coach continued; a line or two may have been missed.
- **FAILURE** — the athlete was **repeatedly pulled out** (had to unlock/tap to keep the Coach
  audible); **or** the Coach *restarted* mid-workout ("Welcome to Corner") — which, per INV-001,
  does not happen.

Reading the prompt's own examples against this: **one cue unheard is not a failure** (Corner is
silence-heavy; a single missed universal reminder is not the Coach stopping). **"Misses five
cues" is not inherently a failure** — if by silence-gating, it's by design; only if caused by
five separate lock/unlock pull-outs is it a continuity failure. The measure is *the athlete's
intervention count*, not the cue-delivery count.

---

## Philosophy review (§8) — "The Coach never stops coaching."

1. **A philosophy statement?** Yes — it is the promise Corner makes.
2. **Technically true today?** **Yes** (INV-001). The runtime, memory, and timing survive
   everything a phone can do short of a remount.
3. **What violates it?** Only a real **remount** — leaving the workout, navigating away, a new
   workout (or the dev-only StrictMode rebuild, PR-029A). A lock/visibility/suspension does
   **not**.
4. **Can the Coach disappear?** Only on unmount (leaving). Never from a lock.
5. **Should the Coach ever restart?** **Never** mid-workout. Confirmed.

So the statement is **true** — and the athlete's felt "the coach stopped" is really "my *ears*
stopped receiving." A hearing gap, not a coaching gap.

---

## Patterns across all prior evidence (§6)

Every investigation independently found the **same three-and-a-half facts**:

| Question | Every investigation's answer |
|---|---|
| Coach muted? | **NO** — the Coach continued |
| Speech unheard? | **YES** (on lock/background; and the raw Chrome stall) |
| Visibility changed? | **YES** (the trigger) |
| Wake lock released? | **YES** (auto on hide; reacquired on return) |
| **Speech recovery in the ears?** | **NO IDEA** — never confirmed on-device, per platform |

The pattern: **we told one story five times.** Each investigation circled the same hinge
(visibility), reported the same survivor (the Coach), and left the same blank (does the audio
actually come back in the ears, per platform?). That blank is the whole investigation.

---

## Verdict on the framing (§5, §10.3)

> **We have been treating one investigation as five.** Continuous Coaching *exists* at the
> Coach level (always) and is *platform-conditional* at the ears level, gated by a single lever
> — keeping the page foregrounded and awake. Speech is the symptom; wake lock is the defense;
> Safari/Chrome are the terrain; visibility is the hinge. The one unanswered question, present
> in every prior investigation, is **speech recovery after visibility, per platform.**

---

## Recommendations — future investigations only (§10.4). No implementation.

1. **The speech-recovery matrix (fill the "NO IDEA").** On real devices — Safari iOS, Chrome
   iOS, Chrome Android, desktop — does audio actually resume in the ears after (a) a screen
   lock/unlock and (b) a tab-switch? Measure it with the **Developer Workout Story** digest +
   the `/dev/speech` sandbox running the **production** resume-nudge (not the raw probe). This
   is the single highest-value next step.
2. **Foreground-continuity investigation.** Where the wake lock *is* honoured, does the page
   ever background anyway (OS low-power, notifications, incoming call)? I.e., is
   "wake-lock-honoured" sufficient for 30-minute foreground continuity, or merely necessary?
3. **Reframe the backlog.** Stop scheduling "speech," "wake lock," "Safari," and "Chrome" as
   separate investigations. Schedule **one**: *page-foreground continuity*. The others are its
   facets.
4. **Product/UAT question (not engineering):** does a single unheard universal reminder matter
   to the athlete at all? The silence-heavy design suggests no — worth confirming, because it
   changes what "continuous" must guarantee.

---

## The final answer

> **Can Corner continuously coach an athlete's ears for 30 uninterrupted minutes?**

**PARTIALLY — and we were partly asking the wrong question.**

- **The Coach never stops coaching** — yes, always, proven. The promise is kept at the runtime
  level on every platform.
- **The ears** receive it continuously only while the page stays foregrounded and awake —
  guaranteed where the wake lock is honoured and the athlete stays in-app; broken where the
  screen sleeps and the athlete must return. That is **one lever** (foreground/awake), not five
  problems.
- The question conflated **the Coach** (never stops) with **the ears** (conditional), and split
  **one** problem into **five**. Corrected, the question — and the only real unknown — is:
  *does the audio reliably return to the ears after a visibility change, per platform?*

**No code was changed. The deliverable is understanding, not solutions.**
