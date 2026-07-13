# ACCESSIBILITY_REVIEW.md — What Improved, What Remains

Accessibility is not a compliance checkbox for Corner — it's core to the promise. A hands-free coaching app is *already* an accessibility play (eyes-free, touch-free operation). This documents what PR-008 improved and what's still open before Beta.

Standard referenced: WCAG 2.2 AA where applicable.

---

## 1. Contrast

**Improved:**
- **Work timer** is `--work` (`0.96` L) on `--background` (`0.08` L) — a ~17:1 contrast ratio, far above AA for large text.
- **Rest** (`--rest`, teal `0.72` L) and **push** (red `0.62` L) on near-black both clear AA for large text (timer is the largest text in the app).
- **Eyebrow labels** use `muted-foreground` (`0.65` L) on `card`/`background` — meets AA for the small-but-not-tiny sizes they're used at; where they sit on coloured state chips they use the state's paired `-foreground` token.
- Difficulty tags use light text on `-900` tints (existing) — legible; flagged below for a formal audit.

**Remaining:**
- **Formal contrast audit** of every difficulty-tag combination and the teal `--rest` at *small* sizes (it's only ever used large today, but if reused small it needs checking). — *Open, P2.*

---

## 2. Screen-reader support

**Improved:**
- Timer carries `role="timer"` + `aria-label="N seconds remaining"`.
- Controls have explicit `aria-label`s ("Pause workout", "Resume workout", "End workout").
- Settings toggles are real switches: `role="switch"` + `aria-checked`.
- Finish rating buttons: `aria-label="Rate N out of 5"` + `aria-pressed`.
- Settings selects/sliders have associated `<label htmlFor>`.
- Decorative elements (progress dots, coach level bars, icons) are `aria-hidden`.
- The unsupported-voice notice uses `role="status"`.

**Remaining:**
- **Live announcements for phase changes** ("Rest", "Round 2", "Final ten seconds") for a screen-reader user running without voice coaching. The voice coach already speaks these, so it's low-priority, but a visual-SR-only user with coaching *off* would benefit from an `aria-live` region on the phase label. Currently the center section is `aria-live="off"` to avoid fighting the voice coach. — *Open, P2.*
- A full VoiceOver/TalkBack pass on the whole flow. — *Open, P1 before Beta.*

---

## 3. Touch targets

**Improved:**
- Workout controls are **64px** (pause/resume/quit) — well above the 44px WCAG target and comfortably glove-hittable.
- Settings toggles 32×56px hit area; segmented choices 44px tall; back links 44px.
- Home/detail/finish CTAs are 56–64px.
- Quit is **set apart** from pause to prevent accidental session-ending taps.

**Remaining:**
- Finish star-rating targets are ~44px with padding — acceptable but could be larger on small phones. — *Open, P2.*

---

## 4. Dynamic / large text

**Improved:**
- Timer uses `vmin`-based `clamp()` so it scales with viewport rather than breaking at fixed sizes.
- Body text uses relative units; headings use `text-balance` to stay readable when wrapped.
- No `maximum-scale` removal of *content* zoom beyond the existing viewport policy (see Remaining).

**Remaining:**
- The viewport sets `maximumScale: 1, userScalable: false` (pre-existing, sensible for a floor-placed timer to prevent accidental pinch-zoom mid-workout) — but this **blocks pinch-zoom globally**, which is a WCAG 1.4.4 concern on the *reading* screens (library, settings, detail). Consider allowing zoom on non-workout routes. — *Open, P1, needs a product call (documented in `RISKS.md`).*

---

## 5. Color-blindness

**Improved:**
- **No state is signalled by colour alone.** Work/rest/push each carry a text label ("Round …", "Rest", the round name) and differ in *layout*, not just hue. A red-green or blue-yellow deficit still gets full information.
- Progress uses shape/size (dot width) in addition to colour.

**Remaining:**
- Difficulty tags rely partly on colour (blue/orange/red) but always include the text label ("Beginner"/"Intermediate"/"Advanced"), so information is preserved. No action required; noted for completeness.

---

## 6. Reduced motion

**Improved:**
- A **global `prefers-reduced-motion` guard** disables all animations/transitions (cue-in, phase-in, count-pulse, breathe, rise) to near-zero duration. The countdown still changes colour (information), it just doesn't pulse.
- Settings surfaces this honestly ("animations are turned off automatically").

**Remaining:**
- None functional. Optional: a manual in-app reduced-motion override for users who can't set it at the OS level. — *Open, P3.*

---

## 7. Landscape & orientation

**Improved:**
- The workout screen reflows to a two-column landscape layout (timer left, cue/controls right) so nothing is cut off when a phone is laid on its side on the floor.
- `.screen` safe-area padding covers all four insets, so landscape notches don't clip content.

**Remaining:**
- Landscape tuning of the *secondary* screens (settings, library) is untested — they scroll, so low-risk. — *Open, P3.*

---

## 8. Large-timer visibility (2–4 m)

**Improved:**
- `timer-hero` fills up to 18rem; tabular figures keep it stable; work/rest/push colour reads across a room; the final-10 pulse draws attention without needing to read the number.

**Remaining:**
- Real-world legibility test on a phone on a gym floor at 2, 3, and 4 m in varied lighting. — *Open, P1, part of the Beta test plan.*

---

## 9. Hands-free friendliness

**Improved (the core accessibility win):**
- The entire session runs **eyes-free and touch-free**: voice coaching speaks structure, cues, counts, and the close; the screen is a *caption*, not the primary channel.
- `CoachPresence` reassures the athlete the coach is live so they trust putting the phone down.
- Nothing to press once started; the only interaction (pause/quit) is large and set apart.

**Remaining:**
- Media-session / lock-screen controls and background-audio robustness (so voice continues with the screen off) — a platform concern, likely partly handled by the existing runtime's `VisibilityObserver`, but not verified in this PR. — *Open, P1 before Beta (`RISKS.md`).*

---

## 10. Summary

| Area | Status |
|---|---|
| Contrast | ✅ Strong; formal tag audit open (P2) |
| Screen reader | ✅ Labelled; full SR pass + phase live-region open (P1/P2) |
| Touch targets | ✅ 64px core; stars could grow (P2) |
| Dynamic text | ✅ Fluid; global zoom-lock needs a product call (P1) |
| Color-blindness | ✅ No colour-only signals |
| Reduced motion | ✅ Global guard |
| Landscape | ✅ Workout screen; secondary untested (P3) |
| Large timer | ✅ Built; real-world test open (P1) |
| Hands-free | ✅ Core strength; background-audio unverified (P1) |

The biggest **remaining** items before Beta — SR flow pass, the zoom-lock decision, real-world large-timer test, and background-audio robustness — are carried into `RISKS.md`.
