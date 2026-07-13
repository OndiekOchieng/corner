# BETA_TEST_PLAN.md — Proving the Coach

Corner's promises are testable: *you get coached, hands-free, and you trust the voice.* This beta exists to find out whether that's true with real boxers, on real bags, before we scale content or features. We are not testing whether people *tolerate* Corner — we're testing whether it feels like **a coach in their corner.**

This is a product/research plan, not an engineering task. It defines what we're trying to learn and how we'll know.

---

## 1. Goals

1. **Validate the core promise** — do athletes actually train hands-free, start to finish?
2. **Test coaching quality** — is the voice clear, well-timed, and *trusted*? Does it feel like coaching, not timing?
3. **Find the friction** — where do athletes hesitate, get confused, reach for the phone, or drop out?
4. **Test differentiation** — do boxers perceive Corner as fundamentally different from an interval timer?
5. **Pressure-test resume & continuity** — does the experience survive real-life interruptions gracefully?

Explicit non-goal: measuring engagement/retention hooks. This beta measures *quality of experience*, not stickiness.

---

## 2. Participants

- **Size:** 5–10 boxers. Small enough for deep qualitative observation, large enough to see patterns.
- **Mix (recruit deliberately across):**
  - **Experience:** 2–3 experienced/returning boxers, 2–3 self-taught enthusiasts, 2–3 fitness boxers / relative beginners.
  - **Setup:** at least a couple who train on a home heavy bag; at least one who shadowboxes without a bag.
  - **Stance:** include at least one **southpaw** (they're the most underserved and the harshest judges of stance-specific coaching).
- **Recruit from:** local gyms, boxing communities, personal networks, social boxing groups. Prioritize people who already train alone on a bag — they feel the absence of a coach most.
- **Screening:** can throw basic punches safely; has a place to train; willing to be observed and interviewed candidly.

---

## 3. Protocol

**Duration:** ~2 weeks of real use per participant.

1. **Kickoff (light):** minimal setup instruction on purpose — first-launch clarity is part of what we're testing. Ask them to use Corner *as they'd actually train*.
2. **Observed first session (in person or video call):** watch the first workout end-to-end without helping. This is the richest data — where they look, when they touch the phone, when they hesitate, how they react to the coach.
3. **Independent use (2 weeks):** train on their own, on their schedule, across a few workout types and at least two coach packs.
4. **Interruption task (assigned once):** during one session, deliberately interrupt (take a call, walk away, let the screen lock) and then return — to test resume in the wild.
5. **Exit interview:** structured qualitative conversation (below).

**Observer discipline:** during observed sessions, don't coach, don't explain, don't rescue. Every moment we intervene is a moment of friction we won't see in the wild.

---

## 4. What to observe (qualitative)

During observed sessions and self-reports, watch for:

- **Screen glances vs. gazes** — do they glance and look away, or get stuck staring? Do they ever *pick up* the phone mid-round?
- **The trust moments** — reactions to the first countdown and first bell. Relief? Doubt? A nod?
- **Confusion points** — moments they don't know what to do, mishear a cue, or wait unsure.
- **Emotional beats** — do they smile, dig in, look like a fighter? Or check out, get annoyed, tune the voice out?
- **The finish** — how do they react to the close? Do they feel *done and coached*, or does it just stop?
- **Coach-pack reactions** — which coach they gravitate to and why; whether packs feel genuinely different.
- **Drop-out moments** — if they quit mid-workout, exactly when and why.

---

## 5. What to measure

### Quantitative (the hard signals)

| Measure | Definition | Why it matters | Success signal |
|---|---|---|---|
| **Hands-free completion** | % of sessions finished with **zero screen touches after Start** | The core promise, directly | Most sessions, most athletes: zero touches |
| **Screen-interaction frequency** | count + timing of mid-workout screen touches | Quantifies "phone down" — the headline metric | Trends toward zero as trust builds |
| **Workout completion rate** | % of started workouts finished | Right length/intensity; coach keeps them in it | High, and steady across the 2 weeks |
| **Voice timing accuracy (perceived)** | # of "the coach said something at the wrong time" reports | Trust-critical; countdown/bell especially | Approaching zero |
| **Resume success** | % of interruptions that resumed cleanly, no replay/double-bell | Continuity & trust | Every interruption resumes cleanly |
| **Coach-pack usage spread** | which packs get chosen/kept | Personalities land and differentiate | Multiple packs get genuine use |

### Qualitative (the truth signals) — 1–5 scales + open-ended

- **Coach clarity:** "Did you always know what to do?"
- **Voice timing:** "Did the coach ever speak at the wrong moment?"
- **Trust:** "Did you trust the coach? Did it ever say anything wrong?"
- **Feeling coached:** "Did it feel like a coach, or like a timer?"
- **Enjoyment:** "Did you enjoy training with Corner? Would you keep using it?"
- **Usability:** "Anything awkward about starting, resuming, or finishing?"
- **Differentiation (unprompted):** "How would you describe Corner to a friend?" *(We want to hear "a coach," not "a timer app," unprompted.)*
- **The one thing:** "What's the one thing that would make you use this every session?"

---

## 6. Success criteria (what "the beta passed" means)

The beta is a **pass** if, across participants:

1. **Hands-free is real** — the strong majority of sessions are completed with zero mid-workout screen touches.
2. **The coach is trusted** — near-zero reports of wrong or mistimed coaching; countdown/bell trusted universally.
3. **It reads as a coach, not a timer** — most athletes describe Corner as *a coach* unprompted, and contrast it with timers favorably.
4. **Resume holds** — interruptions recover cleanly, every time, with no replayed coaching.
5. **They'd keep using it** — most participants say they'd train with Corner again, and can name why.

Any of these failing is a **stop-and-fix** signal before scaling content or shipping wider — especially #2 (trust) and #1 (hands-free), which are the product.

---

## 7. What we're really listening for

Numbers tell us *whether*; boxers tell us *why*. The most valuable output of this beta is a short list of **the moments that won trust and the moments that broke it** — because that list is the roadmap. A single quote — *"I forgot it was an app; it just felt like my coach was there"* — is worth more than any dashboard, and *"it told me ten seconds when there were five, and I stopped believing it"* is the most important bug we could find.

---

## 8. After the beta

- Synthesize findings into a prioritized list of **trust-builders to protect** and **friction to remove**.
- Feed voice/timing findings back into `VOICE_GUIDELINES.md` and `COACHING_PHILOSOPHY.md` (these are living documents).
- Feed coach-pack reactions into `COACH_PACKS.md` (which personalities to invest in, which to cut).
- Only after the core experience is proven do we scale the catalog and add packs — content built on an untrusted coach is wasted content.
