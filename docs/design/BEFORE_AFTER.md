# BEFORE_AFTER.md — Every Significant UX Decision

Each decision below ties back to at least one of: **Product Philosophy** (`../product/`), **Coach Performance** (`../coaching/`), **Hands-free operation**, and **Trust**. Format: *Before → After → Why (with the anchor)*.

---

## Foundation

### The design system
**Before:** ad-hoc spacing/colour/radius per screen; no motion language; no state palette; no reduced-motion.
**After:** one token system — phase-state palette, elevation, motion tokens, fluid timer type, `.screen` safe-area wrapper — in `globals.css`, consumed by shared components.
**Why:** *Trust* and *premium feel* come from **coherence** — a product that looks like one instrument, not eight screens. A system is the only way to keep that true as the app grows. (`DESIGN_SYSTEM.md`)

### `<Button asChild>` → styled `Link`
**Before:** `<Link><Button asChild><span>…</span></Button></Link>` — rendered a `<button>` inside an `<a>` (invalid, and 6 of 9 baseline `tsc` errors).
**After:** navigational CTAs are `Link` elements styled with `buttonVariants(...)`.
**Why:** valid, accessible markup (no nested interactives) and a cleaner type surface. Correctness *is* trust. (`tsc` errors 9 → 1.)

---

## Active Workout screen — *the centerpiece*

### Rest is now a distinct state
**Before:** the runner rendered the same `WorkoutScreen` in every phase; **rest looked identical to work** — same layout, just a different number.
**After:** phase-aware screen. Rest = cool `--rest` colour, "Rest" label, breathing timer, and a "Next Round" preview instead of cues. Work = neutral, cues present.
**Why:** an athlete who **can't see the screen clearly from 3 m** must still know instantly whether to work or breathe. This is *Hands-free* + *Focus*, and it fixes a P0. (`../coaching/ROUND_DIRECTING.md §6`, `../coaching/TIMING_MODEL.md`)

### The timer became the hero
**Before:** fixed `text-9xl`, non-tabular (digits jittered), equal weight with the round card and two cue boxes.
**After:** fluid `timer-hero` (`clamp(6rem, 34vmin, 18rem)`), tabular figures, visually dominant; everything else orbits it.
**Why:** the brief's literal requirement — *huge timer, viewed from 2–4 m, phone on the floor*. A steady, enormous number is the single most-read element; it earns the most space. (*Readability*)

### Countdown emphasis
**Before:** the final ten seconds looked like any other second.
**After:** `--push` red + one calm pulse per second in the final-10 (work only; rest stays calm).
**Why:** the countdown is **the most trust-critical moment in the app** — it must be unmistakable, but *calm under pressure* (the Corner personality), so a heartbeat, not a strobe. (`../coaching/TIMING_MODEL.md §7`, `../coaching/PERSONALITY_SYSTEM.md`)

### Coach presence
**Before:** nothing on screen indicated a coach was there.
**After:** `CoachPresence` — "In your corner" with a live animated level (goes "Coach paused"/"Silent" honestly).
**Why:** the whole promise is *put the phone down, trust the coach*. A quiet, honest signal that the coach is live is what earns that trust. It never fabricates a named coach the athlete didn't choose. (*Trust*, `../product/PRODUCT.md`)

### Controls: minimal, glove-friendly, safe
**Before:** `size="lg"` buttons (36px base) with quit beside pause.
**After:** 64px pause/resume; quit set apart as a quiet icon button.
**Why:** *Hands-free/gloves* → big targets; *"no unnecessary interaction once started"* → one primary control; *Trust* → don't let the athlete end a session by fat-fingering quit. (brief: Workout Screen requirements)

### Round indicator
**Before:** "Round / N of M" stacked text, centered.
**After:** compact numeric pill + a dot-track (≤10 rounds) or bar (>10), top-right.
**Why:** *Readability at a glance* — position is legible without reading small text, and it's robust to any round count. (*Focus*)

---

## Home

### The landing states the promise
**Before:** header + card + two equal buttons; empty state a flat box.
**After:** confident wordmark/tagline; a raised today-card hero with a full-width 64px **Start**; empty state invites ("Pick a session, press start, put the phone down"); secondary nav demoted to quiet tiles.
**Why:** *"understand the product within seconds"* — the first screen must show what Corner is and make **Start** the obvious act. (brief: Definition of Done; `../product/PRODUCT.md`)

---

## Library

### Card is the target; goals lead
**Before:** whole card linked *and* held a "View Workout" button; duration/rounds dominated.
**After:** the card is the single link; intent tags (level, stance) lead, name is the hero, stats sit quietly on a footer.
**Why:** *Avoid unnecessary controls* (one target, less noise) and *emphasize training goals over technical metadata* (brief: Library). (`../workouts/PROGRESSION_MODEL.md` framing)

### Design-only: fuller browse model
**Not built (no data/infra):** filtering by goal/coach/difficulty/duration/stance, favorites, "continue", "recently completed".
**Documented here** as the intended structure: a goal-first filter rail (Foundations, Power, Defense, Conditioning, Recovery, Southpaw), a "Continue" shelf when a session is resumable, and a favorites toggle persisted per workout.
**Why deferred:** these require workout metadata (goals/type) and history/favorite persistence the schema doesn't expose — building them is *new infrastructure*, explicitly out of scope. Marked in `RISKS.md`.

---

## Workout Detail

### Start is always reachable
**Before:** Start at the bottom of a scrolling rounds list.
**After:** Start pinned to the viewport bottom in a blurred bar; intent tags above the title; clean divided stat grid.
**Why:** the primary action must never require hunting — *Focus* + *"press start"*. (brief: Definition of Done)

---

## Rest & Finish

### Rest speaks the shared language
**Before:** neutral timer, static.
**After:** cool rest colour, breathing timer, clear next-round preview (matches the inline rest state).
**Why:** consistency (*premium feel*) and *recovery pacing* — the breathing rhythm is itself a calm coaching cue. (`../coaching/SILENCE_GUIDE.md`, `../coaching/ROUND_DIRECTING.md`)

### The honest close
**Before:** "Workout Complete" (timer-speak); generic star row.
**After:** "Session complete — that was honest work. Well done."; success-green; accessible rating; warmer notes prompt.
**Why:** the finish is a **coaching moment**, the last trust deposit — it should sound like the coach, specific and earned, not like software. (`../coaching/MOTIVATION_MODEL.md §4`)

---

## History

### Motivational empty state
**Before:** "No completed workouts yet" — a scolding blank.
**After:** an invitation ("Your first round starts it all") with an icon and a direct CTA.
**Why:** *motivational without gamified* — encourage the first session, don't shame the empty one. (brief: History)

### Design-only: the populated view
**Not built (no history persistence wired):** streaks, recent coaches, session summaries, progress, resume.
**Documented structure:** a top **streak** band (current/longest, calm — a small flame count, never confetti); a **Recent coaches** row (who's been in your corner); a reverse-chronological **session list** (name, coach, date, duration, rating); a **Resume** card when an unfinished session exists.
**Why deferred:** requires wiring the existing `src/lib/session` history to this route — *new infrastructure/behavior*, out of scope. Top follow-up in `RISKS.md`.

---

## Settings

### Logical grouping + a real fix
**Before:** two cards ("Audio" holding six unlike controls); the rest-warning buttons were **wired to the wrong updater** and did nothing.
**After:** **Coaching · Voice · Sound · Accessibility · Application** groups via reusable primitives; accessible switches; rest-warning now actually updates `restWarning`.
**Why:** *Reduce cognitive load* (brief: Settings), *Trust* (a control that lies about working is worse than no control), and accessibility (real `role="switch"`).

---

## Microcopy (throughout)

**Before → After:**
- "Choose a workout to get started" → "Pick a session, press start, put the phone down."
- "Workout Complete" → "Session complete — that was honest work. Well done."
- "No completed workouts yet" → "Your first round starts it all."
- "Catch your breath, stay focused" → "Breathe. Stay loose."
- "Speech Speed: 1.2x" → "Speed · 1.2×"

**Why:** the interface should **sound like the coach**, not generic software — fewer words, concrete, calm, confident. (`../product/VOICE_GUIDELINES.md`, `../coaching/`)

---

## The through-line

Every decision serves the same sentence: **"Press Start. Put the phone down. Trust the coach."**
- *Press Start* → Start is the hero on home and detail, always reachable.
- *Put the phone down* → huge readable timer, distinct rest, coach presence, nothing to touch once running.
- *Trust the coach* → perfect-feeling countdown emphasis, honest close, honest coach presence, controls that don't betray you, and a coherent premium system that reads as one instrument.
