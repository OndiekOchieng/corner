# WORKOUT_DESIGN.md — How Corner Workouts Are Built

A Corner workout is not a list of intervals. It is a **coached boxing session with a shape**: it warms you up, builds, peaks, and brings you down — like a real trainer's plan. This document defines the anatomy of that session so every workout feels authored, not generated.

Audience: anyone designing a workout or a coach pack. It defines *structure and intent*; `VOICE_GUIDELINES.md` defines how it's spoken; `COACHING_PHILOSOPHY.md` defines cue behaviour.

---

## 1. Workout structure (the session arc)

Every Corner workout follows an intentional arc:

```
Warm up  →  Work rounds (build → peak)  →  Cool down / recovery
              ↑ rest between rounds ↑
```

- **Warm up** — loosen, find range, raise heart rate. Coached, but low intensity.
- **Work rounds** — the body of the session, structured as rounds with rest between.
- **Arc across rounds** — early rounds establish and teach; middle rounds build volume and complexity; late rounds peak in intensity or simulate a fight finish.
- **Cool down** — bring the heart rate down, loosen out, close the session.

A workout has a **name and an intent** ("Orthodox Power — sharpen straight punches and footwork"), a **stance** (orthodox / southpaw / both), a **difficulty**, and a **duration** the athlete can see before starting. The intent is spoken in the intro so the athlete knows *why* they're here.

## 2. Round design

The round is the unit of a boxing workout. Corner's default respects the sport:

- **Classic timing:** 3-minute work rounds, 1-minute rest (adjustable per workout/difficulty — e.g., 2-minute rounds for beginners or conditioning).
- **Each round has a focus**, stated at the start: a punch, a combination, a defensive move, a tactical idea, or a conditioning goal. ("Round three. Body work." / "Round five. Slip and counter.")
- **A round is not random.** It develops one theme. The coach may layer within it ("now add the hook off the jab"), but a round is *about something*.
- **Rounds relate to each other.** Round two builds on round one; the combination introduced early returns later. The workout teaches something over its length.

**Round internal arc:** establish (first ~30s) → work/develop (middle) → push (final ~30s) → countdown → bell. The coaching energy tracks this arc (see `VOICE_GUIDELINES.md §5`).

## 3. Cue density

Cue density is the **heartbeat of the coaching feel** — too little and it's a timer, too much and it's a nag.

- **Baseline:** one coaching cue roughly every **20–40 seconds** of work, plus the structural moments (round start, combination calls, countdown).
- **Density scales with:**
  - **Workout type** — technical/skill rounds are cue-rich; conditioning rounds are sparse (about output, not correction).
  - **Athlete level** — beginners get more cues and more structure; experienced fighters get fewer, sharper cues (see `COACHING_PHILOSOPHY.md §7`).
  - **Coach pack** — a *Technical* coach talks more; an *Old School* coach says less and lets you work.
- **Hard limit:** cues never stack. Minimum spacing between non-structural cues prevents chatter. Structure always wins a timing conflict; the lower-priority cue is dropped, not delayed into a pile-up.

## 4. Rest philosophy

Rest is part of the coaching, not dead air.

- **Rest is recovery, framed by the coach.** At rest start: call it, give one recovery instruction, then mostly go quiet. ("Rest. Breathe deep, shake it out.")
- **Rest is the teaching window.** The one place longer explanation belongs — the *why*, the setup for the next round, a technique detail. Delivered early in the rest, then silence to breathe.
- **Rest previews what's next.** End the rest guidance by naming the next round's focus so the athlete is mentally ready when the bell rings.
- **Never rush the athlete through rest.** The rest is theirs. The coach doesn't fill it with hype or count it down aggressively — a calm "back to work in ten" at most.

## 5. Progression

Corner should feel like it's *taking you somewhere* over days and weeks — even before adaptive features exist.

- **Within a workout:** complexity and intensity build across rounds.
- **Across a catalog:** workouts are tagged by difficulty and focus so an athlete can move from *fundamentals* → *combinations* → *defense & counters* → *conditioning* → *fight simulation*.
- **Suggested paths:** the product can recommend a next workout based on what they've done (e.g., after several "establish the jab" sessions, suggest "jab to combinations"). This is a curation/recommendation concept, not a real-time adaptive engine (that is deliberately future scope).
- **Repeatability with meaning:** repeating a workout should feel like *drilling*, not staleness — the value is in getting sharper at known material.

## 6. Difficulty

Difficulty is **multi-dimensional**, not just "faster." Levels: **Beginner / Intermediate / Advanced.**

| Dial | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Round length | Shorter (2 min) | Classic (3 min) | Classic+ |
| Rest | Generous | Standard | Tighter |
| Combinations | Short, named, repeated | Multi-punch, varied | Long, defensive layers, angles |
| Cue density | High, reinforcing | Balanced | Sparse, sharp |
| Output demand | Forgiving, form-first | Sustained | High, fight-pace |
| Tone | Reassuring | Direct | Demanding |

The same *content* (e.g., "the jab") can appear at every level, coached completely differently. Difficulty is a coaching decision as much as a timing one.

## 7. Warmup

- **Purpose:** raise heart rate, loosen shoulders and hips, find range and footwork, get the mind into the session.
- **Character:** low intensity, movement-focused (light footwork, range-finding jabs, rolls), generously cued and patient.
- **Coached, not skipped.** The warmup is where the coach sets the tone and the intent for the whole session. It should feel like the start of *training*, not a countdown before the "real" workout.

## 8. Cooldown

- **Purpose:** bring the heart rate down, loosen out, close the session with a sense of completion.
- **Character:** slow, calm, low voice. Light shadow movement, shoulder rolls, breathing.
- **The close:** the coach acknowledges the work honestly and specifically, names what was accomplished, and closes. This is the emotional payoff of "you trained today." (See `USER_JOURNEYS.md` — Completion.)

## 9. Workout types (the catalog's shape)

Corner's catalog should span the real training a boxer does:

- **Technical drills** — one skill, high cue density, form-first. ("Sharpen the jab." "Hook mechanics.")
- **Combination building** — chaining punches into flowing combinations. ("Jab-cross-hook, then reset.")
- **Defense & counters** — slips, rolls, guard, and countering. Cue-rich, tactical.
- **Conditioning** — output and endurance. Sparse cues, high demand, about *work capacity*.
- **Fight simulation** — rounds that mimic a bout: varied combinations, defensive exchanges, pace changes, a real finish. The most "fighter" experience.
- **Recovery / technique flow** — low-intensity, movement and form, active-recovery days.

Every workout declares its **type, stance, difficulty, and intent** so the athlete (and the recommendation logic) knows what they're getting.

## 10. Fight simulation & recovery (the two poles)

These deserve special care because they define the range of the product:

- **Fight simulation** is Corner at its most immersive: unpredictable-feeling combinations (within a designed structure), defensive exchanges, pace surges, and a dramatic final round. The coach voices it like a corner during a real bout. This is the experience that makes someone *feel like a fighter*.
- **Recovery** is Corner at its most caring: a coach who knows that training isn't only intensity, that rest days are training days, and that showing up lightly still counts. Low, calm, form-focused. This is the experience that makes Corner sustainable as a *habit*, not just a burn.

---

## 11. Design checklist (for every workout)

1. Does it have a clear **name, intent, stance, and difficulty**?
2. Does it follow the **arc** — warm up, build, peak, cool down?
3. Does each round have **one focus**, and do the rounds **relate**?
4. Is the **cue density** right for its type and level (~20–40s baseline, scaled)?
5. Is **rest** used for recovery *and* teaching, and does it **preview** what's next?
6. Does it **coach the athlete it's for** (beginner vs. advanced), not a generic middle?
7. Does it **end well** — an honest, specific close?
