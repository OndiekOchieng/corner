# Coaching Doctrine — behaviour over information (PR-028)

> Put the phone down. Trust your coach.

Corner coaches **behaviour**. It does not lecture. It does not explain a concept when
fewer words produce the same change. Every line is measured against one question:

> **"Would a great boxing coach say this during a live round?"**

If the answer is no, the line should not exist — no matter how elegant the
architecture that produced it. Success is not how much the coach says. Success is how
quickly the athlete changes what they are doing, in as few words as possible.

---

## The five laws

**LAW ONE — Behaviour beats information.** Prefer `MOVE!` over "Move after every
combination." Prefer `HANDS HOME!` over "Maintain your defensive position." Prefer
`RELAX.` over "Remember to relax your shoulders."

**LAW TWO — Shorter wins.** When two lines produce the same behavioural outcome, the
shorter one MUST win. `OUT!` · `AGAIN!` · `DOUBLE JAB!` · `MAKE HIM MISS!`

**LAW THREE — Silence wins.** The coach does not fill every moment. Silence is the
default; a well-placed word lands because the air around it was quiet. This is
enforced by the `SilenceController` and the per-pack `talkativeness` — this PR did not
loosen either. We removed words; we did not add lines.

**LAW FOUR — Never teach the same concept twice.** Teach once, coach afterwards. The
runtime aggressively avoids duplicated objectives, concepts, transitions,
introductions, and reminders.

**LAW FIVE — Immersion beats completeness.** We are not trying to communicate 100% of
the available information. The athlete should feel *coached*, not *informed* —
challenged, corrected, encouraged, immersed.

---

## What changed in PR-028

### Session introductions — coach, don't brief

The opening was the worst offender. Old Southpaw open:

```
Good evening, fighter.
Southpaw Fundamentals.
Let's make every punch count.
It's southpaw footwork and positioning today — make it count.
Let's go to work.
```

Footwork is taught in the intro, then again by the round. That is LAW FOUR broken in
the first ten seconds. New open:

```
Alright. Southpaw Fundamentals. Let's work.
```

Structurally, `SessionIntroduction` is now **greeting? + opening + transition** — the
`objective` segment (which voiced the workout's `focus`) is **gone**. Naming the
concept in the intro *and* the round is teaching it twice; the round and the work
carry the concept now. Openings and transitions were rewritten to a few words each.
(`SpeechPlanner.composeIntroduction`, `SessionIntroduction`, `personalities.ts`.)

### Doctrine — a coach walking the gym, not a textbook

Reinforcement pools (`reinforcements.ts`) became behavioural micro-coaching:

| Dimension | Before | After |
|---|---|---|
| guard | "Don't let them drop." / "Keep the guard up." | `Hands home!` · `Hands up!` · `Guard!` · `Protect!` |
| footwork | "Stay on your feet." / "Keep cutting angles." | `Move!` · `Angle out!` · `On your feet!` · `Cut the angle!` |
| head | "Keep the head moving." / "Off the centre-line." | `Head moving!` · `Off the line!` · `Make him miss!` · `Slip!` |
| output | "Keep the work rate up." | `Busy hands!` · `Stay busy!` · `More!` · `Keep punching!` |

Reference-encouragement shrank the same way: "Good work. Keep that guard disciplined."
→ `Good. Hands home.`

### Micro coaching — a first-class citizen

One-to-three-word lines (`MOVE!` `OUT!` `AGAIN!` `FEINT!` `BREATHE!` `YES!`) are now
the normal shape of doctrine, not an exception. Per-pack `urgency` banks are micro
(`Dig!`, `Finish!`, `Sharp! Finish!`). **Competition** favours micro most heavily —
its urgency and encouragement are one or two words (`Dig!` · `Finish!` · `Yes!` ·
`That's it!`), and its whole style trends toward the minimal.

### Progression — less explanation over time

Progression is already carried by the **teach-through-exposure** model (see
[BOXING_LEXICON.md](BOXING_LEXICON.md)): a combination is explained on its first
appearance, then spoken as pure shorthand. Beginner hears `One-two-three. Jab, cross,
lead hook.`; a moment later the coach says `One-two-three!` The coach becomes more
concise as the session goes on — without a difficulty setting or new subsystem.

---

## Responsibilities (unchanged — do not collapse these)

| Layer | Owns |
|---|---|
| Workout authors | **WHAT** happens |
| Doctrine (reinforcements/anchors) | **WHAT** matters |
| Coach Packs (`personalities.ts`) | **HOW** it is spoken |
| Coach Runtime | **WHEN** it matters |

This PR only changed the *words* and dropped one intro segment. It did not move a
responsibility, add a feature, touch the Engine/Host/Event/Media/Session runtimes,
or loosen the silence budget. Determinism is intact — banks rotate on a counter, no
clock, no randomness.

---

## Guardrails

`src/tests/coaching/philosophy.test.ts` encodes the laws as behavioural assertions
(intro word-count and no-focus-briefing, reinforcement ≤ 4 words and non-textbook,
micro-coaching present, Competition ≤ 2 words, no line matches the "textbook" pattern
`remember to | maintain your | focus is | it's … today`). Authors can revise phrasing
freely as long as the doctrine holds. When adding a line, read it aloud and ask:
**would a boxing coach actually say this?**
