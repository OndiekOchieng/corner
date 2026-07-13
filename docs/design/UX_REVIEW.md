# UX_REVIEW.md — Every Screen, Audited

A screen-by-screen audit of Corner as it stood before PR-008, the issues found, and the priority of each fix. The lens throughout is the core promise: **"Press Start. Put the phone down. Trust the coach."** — and the design principles (calm, confidence, focus, readability, hands-free, trust).

Severity: **P0** breaks the core promise · **P1** materially hurts the premium feel · **P2** polish. Status reflects PR-008.

---

## Method

Reviewed all nine routes and their components against three questions:
1. Does this feel like **premium sports equipment**, or like a fitness dashboard?
2. Could the athlete run the whole session **without looking at or touching the phone**?
3. Does every element **earn its place**, or is it visual noise?

---

## 1. Active Workout screen — *the most important screen*

**Before:** `flex justify-between` column with a round header card, a centered `text-9xl` timer, a boxed "Current/Next" cue stack, and a row of pause/quit buttons.

| # | Issue | Sev | Status |
|---|---|---|---|
| 1 | **Rest was visually identical to work.** The active runner rendered the same `WorkoutScreen` in every phase — during rest the athlete saw the round layout with a different number. No distinct rest state at all. | **P0** | ✅ Fixed |
| 2 | **No countdown emphasis.** The final ten seconds looked exactly like second 120 — the most trust-critical moment had no visual peak. | **P0** | ✅ Fixed |
| 3 | **Timer not truly huge.** `text-9xl` (8rem) is large but fixed; on a phone on the floor viewed from 2–4 m it under-fills the screen, and digits shifted width (no tabular figures) so the number jittered each tick. | **P1** | ✅ Fixed |
| 4 | **Equal visual weight** across round card, timer, and two cue boxes — no hierarchy, so the eye has to hunt. Reads like a dashboard. | **P1** | ✅ Fixed |
| 5 | **No coach presence.** Nothing on screen reinforced that a coach was talking — undercutting "put the phone down." | **P1** | ✅ Fixed |
| 6 | **Touch targets / gloves.** Buttons used `size="lg"` (h-9 ≈ 36px base) with ad-hoc `h-14`; quit sat directly beside pause, easy to hit by accident mid-session. | **P1** | ✅ Fixed |
| 7 | **No landscape handling** and no safe-area padding — content could sit under a notch or home indicator. | **P2** | ✅ Fixed |

**Resolution:** rebuilt the screen phase-aware. Work and rest now differ in colour (neutral vs. cool rest), label, and layout. A fluid `timer-hero` (`clamp(6rem, 34vmin, 18rem)`, tabular figures) dominates; the final-10 turns push-red with a single calm pulse/second; rest breathes to pace recovery. Added `CoachPresence` ("In your corner" with a live level). Controls are 64px, glove-friendly, with quit set apart. Landscape reflows to two columns; `.screen` respects safe areas.

---

## 2. Home screen

**Before:** header + settings icon, a `TodayWorkoutCard`, then two stacked outline buttons (Library, History). Empty state a flat muted box.

| # | Issue | Sev | Status |
|---|---|---|---|
| 8 | **Doesn't say what Corner is** in the first second. The value ("press start, put the phone down") was nowhere on the landing surface. | **P1** | ✅ Fixed |
| 9 | **Start wasn't the obvious hero.** The today-card's Start button was standard height, visually level with secondary nav. | **P1** | ✅ Fixed |
| 10 | **`<Button asChild>` inside `<Link>`** rendered a `<button>` nested in an `<a>` (invalid, and 4 of the 9 baseline `tsc` errors). | **P1** | ✅ Fixed |
| 11 | Plain "Loading workouts…" text flash. | **P2** | ✅ Fixed |

**Resolution:** confident wordmark + tagline; the today-card is a raised hero with a full-width 64px Start; empty state now invites ("Pick a session, press start, put the phone down"). Secondary nav demoted to two quiet, icon-led tiles. Links styled via `buttonVariants` (valid markup, removes the `tsc` errors). Skeleton loading replaces the text flash.

---

## 3. Workout Library

**Before:** responsive grid of cards; each card = title, description, difficulty/stance pills, duration/rounds, and a "View Workout" outline button.

| # | Issue | Sev | Status |
|---|---|---|---|
| 12 | **Redundant CTA.** The whole card linked *and* contained a "View Workout" button — two targets, more noise. | **P1** | ✅ Fixed |
| 13 | **Metadata-forward, not goal-forward.** Duration/rounds dominated; the training intent (level, stance) was visually secondary — the opposite of the brief. | **P1** | ✅ Fixed |
| 14 | Nested button-in-anchor (`asChild`) again. | **P1** | ✅ Fixed |
| 15 | Loading = centered text; header copy generic ("Choose a workout to get started"). | **P2** | ✅ Fixed |

**Resolution:** the card *is* the link (single target); intent tags lead, name is the hero, stats sit quietly on a divided footer with icons and a hover chevron. Skeleton grid while loading. Fuller browse/filter/favorites model documented as design-only in `BEFORE_AFTER.md §Library` (no data/infra to back filters yet).

---

## 4. Workout Detail

**Before:** back link, title/description, a 4-up metadata card, difficulty/stance pills, a rounds list, and a Start button at the very bottom of the scroll.

| # | Issue | Sev | Status |
|---|---|---|---|
| 16 | **Start below the fold.** On a long rounds list the primary action required scrolling to reach. | **P1** | ✅ Fixed |
| 17 | Metadata card visually heavier than title; pills placed after the stats, so intent read late. | **P2** | ✅ Fixed |
| 18 | Nested button-in-anchor. | **P1** | ✅ Fixed |

**Resolution:** intent tags moved above the title; stats became a clean divided grid; Start is pinned to the viewport bottom in a blurred bar (always reachable), with bottom padding so it never covers the last round.

---

## 5. Rest screen (standalone route)

**Before:** centered "REST" eyebrow, `lg` timer, a next-round box, "Catch your breath" line.

| # | Issue | Sev | Status |
|---|---|---|---|
| 19 | No visual identity distinct from work — same neutral timer colour. | **P1** | ✅ Fixed |
| 20 | Static; nothing paced recovery. | **P2** | ✅ Fixed |

**Resolution:** adopts the shared rest language — cool rest colour, breathing timer, clear next-round preview. (The main flow now renders rest inline in the phase-aware `WorkoutScreen`; this route matches it.)

---

## 6. Finish screen

**Before:** "Workout Complete" eyebrow, big name, a 3-stat card, a star-rating + notes card, a Done button.

| # | Issue | Sev | Status |
|---|---|---|---|
| 21 | **Generic close.** "Workout Complete" is timer-speak, not a coach's honest close — misses the trust/coaching payoff (`../coaching/MOTIVATION_MODEL.md`). | **P1** | ✅ Fixed |
| 22 | Star buttons had no `aria-pressed`/labels; nested button-in-anchor on Done. | **P1** | ✅ Fixed |
| 23 | Stat cards visually heavier than the moment of completion. | **P2** | ✅ Fixed |

**Resolution:** an honest, specific close ("That was honest work. Well done."), success-green accents, a divided stat strip, accessible rating (labels + `aria-pressed`), warmer microcopy.

---

## 7. History

**Before:** back link, title, and a single flat "No completed workouts yet" card. No design for the populated state.

| # | Issue | Sev | Status |
|---|---|---|---|
| 24 | **Blank, slightly scolding empty state**; no path forward. | **P1** | ✅ Fixed |
| 25 | **No populated design** for streaks / recent coaches / progress / resume (brief asks for these). | **P1** | 📐 Design-only |

**Resolution:** premium, motivational empty state (icon, "Your first round starts it all", direct CTA). The full populated design — streaks, recent coaches, session summaries, resume, progress — is specified in `BEFORE_AFTER.md §History` and `DESIGN_SYSTEM.md`, but **not built**, because no session-history persistence is wired to this page and doing so would add infrastructure (out of scope). Marked as the top post-PR opportunity in `RISKS.md`.

---

## 8. Settings

**Before:** two large cards ("Audio Settings" holding 6 controls, "Workout Options" holding 1), then a reset button. Custom toggles/sliders inline.

| # | Issue | Sev | Status |
|---|---|---|---|
| 26 | **Poor grouping / high cognitive load.** Six unlike controls crammed under "Audio"; unclear hierarchy. | **P1** | ✅ Fixed |
| 27 | **Functional bug:** the Rest-Warning buttons called `updateVoiceSettings` — they never changed `restWarning`. | **P1** | ✅ Fixed |
| 28 | Toggles lacked `role="switch"`/`aria-checked`; inconsistent control sizing. | **P1** | ✅ Fixed |
| 29 | No Accessibility section despite the app respecting reduced-motion / text size. | **P2** | ✅ Fixed |

**Resolution:** regrouped into **Coaching · Voice · Sound · Accessibility · Application** with reusable `SettingGroup/SettingRow/Toggle/SegmentedChoice` primitives (accessible switch, 44px+ targets). Fixed the rest-warning binding. Added an honest informational Accessibility group.

---

## 9. Cross-cutting issues

| # | Issue | Sev | Status |
|---|---|---|---|
| 30 | **No design system.** Ad-hoc spacing, radii, and one-off colours per screen; no motion language; no state palette. | **P1** | ✅ Fixed (`DESIGN_SYSTEM.md`) |
| 31 | **`asChild` anti-pattern** repeated across 6 components (invalid markup + 6 `tsc` errors). | **P1** | ✅ Fixed (styled `Link`) |
| 32 | **No safe-area / landscape** handling anywhere. | **P2** | ✅ Fixed (`.screen`, landscape variants) |
| 33 | **No reduced-motion** support ahead of adding motion. | **P1** | ✅ Fixed (global guard) |
| 34 | Microcopy read like software ("Choose a workout to get started", "Workout Complete"). | **P2** | ✅ Fixed |

---

## Priority summary

- **P0 (promise-breaking), all fixed:** invisible rest state; no countdown emphasis.
- **P1 (premium feel), fixed:** hierarchy on the workout screen, coach presence, glove targets, home/library/detail/finish/settings polish, the `asChild` markup+type bug, settings grouping, the rest-warning functional bug, reduced-motion, the design system.
- **P1 (design-only, not built):** populated History (needs history persistence = infrastructure).
- **P2, fixed:** landscape/safe-area, skeletons, microcopy, motion.

The one deliberately deferred item (populated History) is called out in `RISKS.md` as the highest-value follow-up before Beta.
