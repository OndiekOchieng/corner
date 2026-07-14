# COACH_PERFORMANCE.md — What Makes Corner a Coach

Corner is not a timer that talks. It is a coach that happens to keep time. This document defines the difference — the principles of *performance* that make an athlete on a bag, who cannot see the screen, feel **coached by someone who is paying attention** rather than read to by a script.

Everything in `docs/coaching/` elaborates one of the ideas below. Grounded in `../product/COACHING_PHILOSOPHY.md` and `../product/VOICE_GUIDELINES.md`; the vocabulary lives in `../workouts/CUE_LIBRARY.md`.

> A timer counts down. A coach decides. The gap between those two verbs is the entire product.

---

## 1. Coaching vs. narration

Narration describes what is happening ("thirty seconds left, keep punching"). Coaching changes what happens next ("last thirty — sit down on the cross, then get out"). The test for every line the coach says:

- **Does it change the athlete's next action, attention, or state?** If not, it is narration — cut it.
- **Would a real coach in the room say this, here, now?** If a coach standing beside the bag would stay quiet, Corner stays quiet.
- **Does it assume a person, not a playback?** A coach remembers what round it is, what was just taught, and what the athlete is about to face. Narration has no memory; coaching does (see `TIMING_MODEL.md`, `ROUND_DIRECTING.md`).

Narration fills time. Coaching *uses* time. A workout that never stops talking is narration no matter how good the individual lines are.

---

## 2. How a coach builds trust

Trust is the product (`../product/PRODUCT.md`). It is built and lost on specifics:

- **Perfect timing on the non-negotiables.** The countdown and the bell are exact, every time. One mistimed countdown and the athlete stops believing anything the coach says. Precision here *earns* the right to be listened to everywhere else (`TIMING_MODEL.md §7`).
- **Never claim to see what you can't.** The coach gives universal reminders ("hands back"), never fake observation ("your left is dropping"). One "nice head movement" when the athlete was standing still and the illusion is dead forever.
- **Say true things.** Cues are boxing-correct. Praise is earned and specific. A coach who says "beautiful" at random is a coach who isn't watching — and the athlete knows it.
- **Be consistent in character.** The same coach sounds like the same person from warmup to close (`PERSONALITY_SYSTEM.md`). Tonal whiplash reads as a machine shuffling scripts.
- **Respect the athlete's body.** Never push through pain, never shame, never demand what could injure. Safety is a trust behavior, not just a rule.

Trust compounds: every honest, well-timed, in-character moment is a deposit; every mistimed, fake, or off-character moment is a large withdrawal.

---

## 3. Corrections vs. encouragement — two different tools

They are not interchangeable, and confusing them is the mark of an amateur.

| | **Correction** | **Encouragement** |
|---|---|---|
| Purpose | Change a mechanic or decision | Reinforce effort/identity, build confidence |
| Timing | The moment the fix is actionable | After earned work; at the low points; on the close |
| Density | Sparse, one thing at a time | Rarer than you think; specific, never on repeat |
| Failure mode | Nagging, stacking, contradicting | Empty hype, praise inflation, cheerleading |
| Feels like | "Sharper — snap it back" | "That round was disciplined" |

**Rules:**
- A correction fixes **one thing**, framed as the *next rep*, never as a criticism of the last one. "Turn the hip" — not "you're not turning your hip."
- Encouragement is **earned and specific**, tied to a real thing the athlete just did or endured ("you held the guard the whole round"), never generic and never on a loop (`MOTIVATION_MODEL.md`).
- **Don't correct and encourage in the same breath.** "Great, but fix your feet" cancels both. Separate them in time.
- When in doubt between the two, **instruct** — a clear technical cue is more respectful and more useful than hollow motivation (`MOTIVATION_MODEL.md §3`).

---

## 4. Managing attention

The athlete has one channel of attention and it's mostly on the bag. The coach's job is to point that beam, not flood it.

- **One idea at a time.** Attention is serial. Two cues in three seconds means the second erases the first.
- **Sequence, don't stack.** Establish, then refine, then push — across the round's arc (`ROUND_DIRECTING.md`), never all at once.
- **Protect the important moments.** Before the countdown, before a combination call, at the bell — clear the airspace so the critical line lands alone.
- **Direct attention where the work is.** Early round: mechanics. Mid: rhythm and application. Late: output and heart. The focus of the cues *is* the athlete's focus.
- **Silence is a pointer too.** Going quiet after a cue tells the athlete "work on that now." Filling the silence steals the rep (`SILENCE_GUIDE.md`).

---

## 5. Managing cognitive load

A tired athlete under exertion has *less* working memory, not more. Coaching load must fall as physical load rises.

- **Load is inverse to intensity.** In the hard final thirty, the athlete can hold one short word — "dig" — not a technical sentence. Teaching happens when they can breathe (rest), not when they're gassed.
- **Short as the round gets hard.** Sentence length tracks fatigue: 1–6 words mid-round, dropping to one or two words at the peak. Full sentences only in rest (`TIMING_MODEL.md`).
- **Chunk complexity into rounds.** Introduce a skill in one round, layer it in the next, apply it under pressure in a third — never dump the whole sequence into one round.
- **Reuse a small, consistent vocabulary.** The athlete shouldn't have to decode new phrasing under load. Rotate wordings to avoid robotic looping (`../workouts/CUE_LIBRARY.md §7`), but keep the *concepts* familiar.
- **The teaching window is rest.** All the "why," all the setup, all the multi-sentence explanation lives in the rest period when there's spare cognition (`ROUND_DIRECTING.md §E`).

---

## 6. The decision to speak

The most important coaching skill is *choosing whether to say anything at all.* Before any non-structural line, the coach runs a silent gate:

1. **Is this the right moment?** (Not mid-combination, not stacked on the last cue, not during earned flow.)
2. **Will it change something?** (Action, attention, or state — else it's narration.)
3. **Is it worth the interruption?** (Every word spends attention the athlete needs for the bag.)
4. **Is it true and safe?** (Boxing-correct, no fake observation, nothing that could hurt.)
5. **Does it fit this coach, this round, this athlete's level?**

If any answer is no, the coach says nothing — and that silence is coaching, not absence (`SILENCE_GUIDE.md`). The default is quiet; speech is the exception the coach *earns* by having something worth the athlete's attention.

---

## 7. The performance contract

> Corner speaks only to change the next action, at a moment that respects the athlete's attention and load, in true boxing language, in a consistent voice, with perfect timing on the things that matter — and stays silent the rest of the time. That is the difference between a coach and a timer, and it is the whole job.

---

## Amendment — PR-020: Session introduction & voice readiness

The session's **first impression** is part of the performance and gets two refinements
(design in [`../coaching-runtime/SESSION_INTRODUCTIONS.md`](../coaching-runtime/SESSION_INTRODUCTIONS.md)
and [`../coaching-runtime/VOICE_READINESS.md`](../coaching-runtime/VOICE_READINESS.md)):

- **The opening is a structured `SessionIntroduction`**, not a flat line — optional
  short greeting, opening framing, and a hand-off to work. It is owned by the Coach
  Pack. Per PR-028 the intro no longer briefs the workout's focus/objective: naming a
  concept in the intro *and* again in the round is teaching it twice (LAW FOUR). The
  opening coaches, it does not brief — "Southpaw Fundamentals. Let's work." See
  [COACHING_DOCTRINE.md](COACHING_DOCTRINE.md).
- **The first line is spoken in the correct coach voice.** The intro utterance waits
  (bounded, ~800 ms) for voice readiness while the timer starts immediately — the coach
  never opens in the browser default voice, and the workout is never delayed. This
  extends the perfect-timing clause of the contract to *voice*, not just to countdowns.

---

## Amendment — PR-020C: a coach that remembers

Performance now includes *memory*. Backed by [COACHING_MEMORY.md](COACHING_MEMORY.md)
and [BOXING_LEXICON.md](BOXING_LEXICON.md):

- **Reinforcement, not repetition.** The same lesson recurs in fresh words
  ("Keep your hands high" → "Hands home!" → "Guard!"), never the identical sentence.
  Reinforcement *replaces* a repeated line — it does not add one, so density and
  silence are unchanged. Per PR-028 the doctrine is behavioural micro-coaching (a
  coach shouting across the gym), not a textbook — see
  [COACHING_DOCTRINE.md](COACHING_DOCTRINE.md).
- **Encouragement references the lesson**, not a hollow "Great job" — "Good. Hands
  home." — still an instruction about the taught concept, never a claim to see the
  athlete.
- **Boxing language is taught, then used.** Call signs are explained once ("Every time
  I say one, I mean the jab.") and then used as shorthand; each pack speaks at its own
  vocabulary level. The athlete learns the language by training.
- **Determinism holds.** Memory improves judgement; variety is deterministic rotation,
  never randomness.
