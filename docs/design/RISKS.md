# RISKS.md — Remaining UX Weaknesses Before Beta

PR-008 made Corner feel like a premium coach rather than an interval timer. These are the honest remaining weaknesses, ranked by how much they threaten the core promise before Beta. Each notes *risk*, *impact*, and *recommended action*.

Severity: **P1** address before Beta · **P2** address during Beta · **P3** track.

---

## P1 — Address before Beta

### R1. History is empty by design
**Risk:** the populated History view (streaks, recent coaches, session summaries, progress, resume) is **specified but not built** — no session-history persistence is wired to the page. A returning athlete currently sees only an empty state, no matter how many sessions they've run.
**Impact:** undercuts retention and the "kept in your corner" promise; History is a headline surface in the brief.
**Action:** wire the existing `src/lib/session` runtime (SessionManager/HistoryService) to the History route and build the populated design in `BEFORE_AFTER.md §History`. This is **infrastructure work** deliberately out of PR-008's scope — schedule it as the immediate follow-up PR.

### R2. Global pinch-zoom is disabled
**Risk:** `viewport` sets `userScalable: false` (sensible for a floor-placed timer to prevent accidental zoom mid-round) but it applies to **every** route, including reading screens — a WCAG 1.4.4 concern.
**Impact:** low-vision users can't zoom the library/settings/detail text.
**Action:** a product call — allow zoom on non-workout routes while keeping it locked on the active screen, or accept the trade-off explicitly. (`ACCESSIBILITY_REVIEW.md §4`)

### R3. Background audio / lock-screen not verified
**Risk:** the whole promise assumes voice coaching continues with the **screen off / phone in pocket or on the floor**. PR-008 didn't verify audio survives backgrounding, screen lock, or interruptions (calls, other media), nor add media-session/lock-screen controls.
**Impact:** if the coach goes silent when the screen sleeps, "put the phone down" breaks completely.
**Action:** test on real iOS/Android; confirm the runtime's `VisibilityObserver` keeps the clock/voice alive; add a MediaSession handler. Highest-value robustness test before Beta.

### R4. Real-world large-timer legibility untested
**Risk:** the 2–4 m readability is designed for but not measured on a real phone on a real gym floor in real lighting (glare, sweat, movement).
**Impact:** if the timer/labels aren't legible at distance, the core use case fails silently.
**Action:** field test at 2/3/4 m in bright and dim rooms; adjust `timer-hero` clamp ceiling and rest/push lightness if needed. Fold into the Beta test plan.

### R5. Full screen-reader pass not done
**Risk:** individual controls are labelled, but the end-to-end flow hasn't been driven with VoiceOver/TalkBack; phase changes aren't announced to an SR user running with voice coaching *off*.
**Impact:** blocks a segment of users from a nominally accessibility-forward product.
**Action:** one full SR pass of home → detail → active → finish; add an `aria-live` phase-label region gated to coaching-off. (`ACCESSIBILITY_REVIEW.md §2`)

---

## P2 — Address during Beta

### R6. Coach identity is presence-only
**Risk:** the app has **no coach-selection concept in code** — coaches exist only in docs (`../coaching/PERSONALITY_SYSTEM.md`). `CoachPresence` honestly shows *a* coach is speaking but the athlete can't *choose* a coach, and the brief's "the athlete has chosen a coach, not merely a voice" isn't fully realised.
**Impact:** a core piece of the product story (six personalities) isn't reachable in the UI.
**Action:** design + build coach selection (a Coach Packs browse/pick surface) — requires a coach data model + persistence (infrastructure), so scope as its own PR. Until then, `CoachPresence` deliberately avoids naming a coach the athlete didn't pick (no fabricated identity).

### R7. Library has no discovery beyond a flat grid
**Risk:** filtering/sorting by goal, coach, difficulty, duration, stance, plus favorites/continue/recent, are documented design-only. With a small catalog it's fine; as the catalog grows the flat grid won't scale.
**Impact:** discovery friction as content grows.
**Action:** build the goal-first filter model (`BEFORE_AFTER.md §Library`) once workout metadata (goal/type) and favorite persistence exist.

### R8. Finish data is passed via URL query params
**Risk:** the finish screen reads `duration`/`rounds` from query string; the rating + notes are captured in local state and **not persisted anywhere**.
**Impact:** the athlete rates a session and it evaporates — a small trust ding, and it blocks History (R1).
**Action:** persist the completed session (ties into R1's session wiring).

### R9. Two rest implementations
**Risk:** rest renders inline in the phase-aware `WorkoutScreen` (main flow) *and* there's a standalone `/workout/rest` route + `RestScreen`. They share the visual language now but are separate code paths.
**Impact:** drift risk over time.
**Action:** confirm whether the standalone route is still used; if not, retire it to keep one source of truth.

---

## P3 — Track

### R10. Star-rating targets are ~44px
Acceptable but could be larger on small phones. (`ACCESSIBILITY_REVIEW.md §3`)

### R11. Landscape untuned on secondary screens
Settings/library scroll in landscape (low-risk) but aren't visually tuned. (`ACCESSIBILITY_REVIEW.md §7`)

### R12. No in-app reduced-motion / theme override
The app respects OS reduced-motion and is dark-only; some users may want in-app control. Low priority. 

### R13. Difficulty-tag contrast not formally audited
Legible in practice; formal AA audit of every tint pending. (`ACCESSIBILITY_REVIEW.md §1`)

---

## Summary — the four that matter most

If only four things are done before Beta, do these:
1. **R3 — background audio robustness** (or the promise breaks entirely).
2. **R1 — wire History** (retention + the "kept in your corner" promise).
3. **R4 — real-world large-timer test** (validates the core use case).
4. **R2 — the zoom-lock decision** (accessibility compliance + a clear product stance).

Everything else is refinement. None of the P1s are regressions from PR-008 — they are the **next** layer of work that PR-008's constraints (no new infrastructure, no engine/workout/coaching redesign) intentionally left for follow-up PRs, now clearly scoped.
