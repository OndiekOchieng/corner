# INV-004 — Page Foreground Continuity (→ Athlete Continuity)

**Investigation only. No code, no fixes, no architecture.** One question:

> **Can Corner continuously coach an athlete's ears WITHOUT requiring them to remember their
> phone exists?**

Follows [INV-001 (Coach Continuity)](COACH_CONTINUITY.md) — *the Coach never stops coaching* —
and [INV-003 (Continuous Coaching)](CONTINUOUS_COACHING.md) — *the Coach never stopped; the
hearing did*, which reframed five problems into one lever: **page foreground continuity.** This
investigation puts that lever itself on trial.

---

## Verdict (up front)

**PARTIALLY — and "page foreground continuity" was still the wrong metric.**

INV-003 was right that the five problems collapse to one hinge (visibility). But it named the
lever *page foreground continuity*, and that is a **proxy**, not the goal. The athlete never
asks "was the page foregrounded?" They ask **"did I have to remember my phone exists?"** The
true invariant is **athlete non-intervention**, and foreground continuity is neither *necessary*
nor *sufficient* for it:

- **Not necessary.** Audio can, on some platforms/strategies, survive foreground loss (media
  playback continues backgrounded). Where it does, the page can lose foreground and the athlete
  still never touches the phone → success *without* foreground continuity.
- **Not sufficient.** The page can hold foreground while the ears still go quiet — a Chrome
  `speechSynthesis` stall with no visibility change (WHERE_IS_SPEECH_DYING), or a cue lost to
  the silence gate. Foreground held; hearing didn't.

So the answer is **PARTIALLY** (platform-conditional at the experience level), and the meta-
finding is: **we should be measuring ATHLETE INTERRUPTION, not FOREGROUND CONTINUITY.** We
refined our way from "speech" to "foreground," and foreground is one step too technical. One
more step lands on the athlete.

---

## The single failure event: athlete intervention

The reframe in one line:

> A visibility change is not a failure. A suspended AudioContext is not a failure. A released
> wake lock is not a failure. A single unheard cue is not a failure.
> **The only failure is: the athlete had to intervene** — unlock, tap, refresh, reopen,
> *remember the phone.*

Every technical event is upstream of that node and only matters insofar as it forces the node.
If the chain self-heals before the athlete notices or acts — audio auto-resumes, the wake lock
reacquires, the gap falls inside Corner's default silence — then **all the technical events
fired and there was no failure at all.**

```
Visibility → hidden  ─┐
Wake lock released   ─┤
Speech interrupted   ─┼──►  ears quiet?  ──►  athlete NOTICES?  ──►  athlete must ACT?
Foreground lost      ─┘         │no                │no                    │yes
                                ▼                   ▼                      ▼
                             no failure         no failure            ★ FAILURE ★
                                                                   (the only failure node)

   … the COACH keeps coaching through every one of these (INV-001) …
```

---

## Q1 — What is "Page Foreground Continuity" actually about?

It is labelled *pages*; it is really about the **athlete**. Reading the examples against the
intervention test:

| Example | Verdict | Why |
|---|---|---|
| Page always foregrounded | usually SUCCESS | foreground → audio alive → no intervention — but not *guaranteed* (speech can still stall) |
| Speech naturally recovers | **SUCCESS iff no gesture was needed** | if resume was automatic, the athlete never acted; if it needed a tap (iOS autoplay), that tap *is* the intervention → failure |
| Wake lock releases once and reacquires naturally | SUCCESS | a self-healing dim, no intervention |
| **The athlete never touches the phone** | **SUCCESS** | this is the real definition |

So "Page Foreground Continuity" is about **athletes** (non-intervention), with **audio** as the
mechanism and **foreground / wake lock** as one *means* to it — not the end. The honest name is
**Athlete Continuity**.

---

## Q2 — What interrupts the athlete? (and are all interruptions equal?)

The athlete "remembers the phone" only when three things line up: the ears go quiet **and** the
athlete **notices** **and** they must **act** to fix it. Most technical events fail one of those
gates (silence covers the gap; audio self-heals; the athlete is mid-combo and doesn't look).

Interruptions are **not** equal — the currency is **forced-intervention count**, not events:

| Event | Failure? |
|---|---|
| One cue unheard | **No** — silence-heavy design; unnoticed; no intervention |
| One wake-lock release that self-reacquires | **No** — self-healed, no intervention |
| One lock that *required* an unlock | **Minor** — one intervention; a blemish, not a broken session |
| Five lock/unlock cycles | **Failure** — the phone dominated the workout |

**Athlete interruption begins the instant the athlete must ACT**, and its severity is the
*frequency* of that action across the session — a gradient, not a binary. An unperceived,
self-healing gap is not an interruption at all.

---

## Q3 — Platform review

| | survives foreground loss | recovers | requires intervention? |
|---|---|---|---|
| **Coach Runtime** (all platforms) | ✅ everything (memory/timing/judgment) | n/a — never stopped | never |
| **Chrome / Android** | JS throttled; AudioContext may suspend | audio resumes on visible (+ resume-nudge) | usually **no** |
| **Desktop (Chrome/Safari)** | backgrounded; audio suspends | resumes on focus | usually **no** |
| **Safari iOS 16.4+** | page **frozen** (JS halts); audio suspended; wake lock honoured (native) | resume on return — **may need a gesture** | **sometimes** (the gesture) |
| **iOS (wake lock ignored — "Case C")** | screen sleeps despite the lock; page hidden; audio suspended | resume on return — may need a gesture | **yes** (unlock, then maybe a tap) |

**iOS is double jeopardy:** it's the platform where the *defense* (wake lock) is weakest **and**
the *recovery* (audio resume) is most likely to need a gesture — so it's the one place the
athlete is most likely to be forced to act. Elsewhere, uninterrupted coaching genuinely exists.

**Can uninterrupted coaching exist despite platform differences?** Yes — on platforms that keep
audio alive without a gesture. It fails precisely where the platform forces a gesture.

---

## Q4 — Relationships: where does failure occur?

**Only at "the athlete must intervene."** Not at visibility change, not at speech interrupt, not
at wake-lock release. Those are *causes that may or may not propagate* to the failure node. The
whole prior chain (INV-003) is real, but it is a chain of *risk*, not a chain of *failure* —
failure is a single downstream event, and it is the athlete's, not the machine's.

---

## Q5 — "The Coach never stops coaching." (still true)

1. **Survives every interruption?** Yes (INV-001) — short of a remount.
2. **Uninterrupted coaching despite interrupted hearing?** Yes — *coaching* continuity and
   *hearing* continuity are different axes; the Coach coaches through silence in the ears.
3. **Can foreground continuity fail while Continuous Coaching succeeds?** **Yes** — foreground
   can be lost yet, if the athlete never notices or acts, the coaching experience is
   uninterrupted. This is the proof foreground is the wrong metric.
4. **Are we investigating foreground continuity or athlete continuity?** **Athlete continuity.**
   That is the correction this investigation makes.

---

## Q6 — Future investigations only (no fixes)

1. **Athlete Interruption Matrix** — *the headline.* On real devices, in a full 30-minute
   session, **count the forced interventions** (unlock / tap / refresh / reopen), per platform.
   This measures the actual product promise; foreground/speech are inputs to it.
2. **Foreground Behaviour Matrix** — what *actually* happens to audio on foreground loss per
   platform: suspend, keep-playing, or need-a-gesture? (Distinguishes "not necessary" cases.)
3. **Speech Recovery Matrix** (carried from INV-003) — does audio resume **without a gesture**,
   per platform? The gesture requirement is the difference between self-heal and intervention.
4. **Audio Backgrounding investigation** — the deepest challenge: can the coach's audio survive
   foreground loss *at all* (is foreground even required for the ears)? If audio can play
   backgrounded, "foreground continuity" is dethroned entirely. Investigation, not a fix.
5. **Perception-threshold study (product/UAT)** — how long a silent gap, or how many forced
   interventions, before an athlete "remembers the phone"? This *defines* the failure threshold
   that all the matrices above are measured against.

---

## The final answer

> Can Corner continuously coach an athlete's ears without requiring them to remember their phone
> exists?

**PARTIALLY — and we had refined our way to the wrong metric.**

- **Yes**, on platforms that keep audio alive without a gesture (wake lock honoured and audio
  auto-resumes, or audio that never suspends): the athlete never remembers the phone.
- **No**, on platforms that force a gesture (notably iOS, where the wake lock may be ignored
  *and* audio resume may need a tap): the athlete must act, and the phone reappears.
- The correct invariant is **athlete non-intervention**, not **page foreground continuity**.
  Foreground is a proxy that both *under-counts* success (audio can survive background) and
  *over-counts* it (foreground can hold while the ears go quiet). The single failure event is
  the athlete having to intervene — and the right next investigation is the **Athlete
  Interruption Matrix**, not another study of the page.

The promise was never "keep the page foregrounded." It was **"forget the phone; remember the
boxing."** Measure that.

**No code was changed. The deliverable is understanding, not solutions.**
