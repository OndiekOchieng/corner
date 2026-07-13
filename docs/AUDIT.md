# Corner — Frontend Engineering Audit

**Audited:** 2026-07-12
**Reviewer:** Senior Staff Frontend Engineer (read-only audit — no code modified)
**Scope:** `app/`, `components/`, `hooks/`, `lib/`, `types/`, `data/`, config
**Stack:** Next.js 16.2 (App Router), React 19, TypeScript 5.7, Tailwind v4, base-ui, shadcn, Web Speech API, Web Audio API
**Size:** ~3,600 LOC across 43 TS/TSX files. No tests, no ESLint config, no README.

---

## 1. Executive Summary

Corner is a distraction-free boxing/heavy-bag coaching app. The concept is clear and the file layout is tidy and conventional. However, **the application's headline capability — the voice coach ("the coach in your corner") — does not run at all**, and the end-of-workout summary always shows zeros. Several complete feature areas (custom workouts, the workout builder, history, "today's workout") are built but never wired into any route, and the countdown timer freezes whenever the screen sleeps — fatal for a hands-free bag workout.

Underneath, the code is a **prototype generated in phases that were never integrated**: there are two timer hooks (one is a non-functional stub), two speech hooks, two workout data sources, and a state machine that references a `WARMUP` phase it can never enter. TypeScript build errors are suppressed (`ignoreBuildErrors: true`) and there are 9 real type errors on `main`.

**Verdict:** Not production-ready. The core workout loop needs a focused stabilization pass (Phase 0) before anything else. The good news: the domain model and component decomposition are sound, so most fixes are surgical rather than rewrites.

### Severity summary

| Severity | Count | Meaning |
|---|---|---|
| **P0 — Blocker** | 4 | Core feature broken or app unusable for its purpose |
| **P1 — Critical** | 10 | Correctness, accessibility, or robustness defect users will hit |
| **P2 — Major** | 11 | Unwired features, dead code, missing engineering practices |
| **P3 — Minor** | 7 | Consistency, hygiene, small debt |

---

## 2. Blockers (P0)

### P0-1 — The voice coach never runs
**Files:** `app/(routes)/workout/[id]/active/page.tsx:47-67`, `hooks/useWorkoutEngine.ts:123-130`

The `CoachingManager` (round intros, timed cues, countdowns, rest/finish speech) is only ever constructed inside an effect gated on `engine.phase === WorkoutPhase.WARMUP` (`active/page.tsx:50`). But the engine **never enters `WARMUP`** — `playWorkout()` transitions `IDLE → ROUND_ACTIVE` directly (`useWorkoutEngine.ts:124-128`), and `getPhaseSeconds()` explicitly treats warmup as unimplemented (`useWorkoutEngine.ts:50-51`). Therefore `coachingManagerRef.current` stays `null` forever, and every downstream effect that guards on it (`announceRound`, `checkCoachingCues`, `checkCountdown`, `announceRest`, `announceCompletion`) is a no-op.

**Impact:** The entire spoken-coaching feature — the product's reason to exist — is dead. Only the Web Audio bells fire. Users get a silent timer.

### P0-2 — Finish screen always shows zeros
**Files:** `app/(routes)/workout/[id]/active/page.tsx:135`, `app/(routes)/finish/page.tsx:9-12`

On completion the active page navigates to `/finish?workoutId=${id}`, but `FinishPageContent` reads `workoutName`, `duration`, `roundsCompleted`, and `totalRounds` from the query string (`finish/page.tsx:9-12`). `workoutId` is never read. Every finished workout therefore renders **"Workout", 0m duration, 0/0 rounds**. The rating and notes captured on that screen (`FinishScreen.tsx:23-24,80-85`) are also never persisted anywhere.

**Impact:** The reward/summary moment of every session is broken.

### P0-3 — Timer freezes when the screen sleeps / tab backgrounds
**File:** `hooks/useRAFTimer.ts:39-67`

The countdown is driven by `requestAnimationFrame`. Browsers throttle or fully suspend rAF when the tab is hidden or the device screen turns off. For a heavy-bag workout the user is punching, not holding the phone — the screen **will** dim and sleep, and the timer stops counting (it "catches up" in one jump only when refocused). There is no [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), no `visibilitychange` resync, and no timestamp-anchored recomputation. The hook's own docstring claims "high accuracy across browser focus changes" (`useRAFTimer.ts:22-24`) — this is not true.

**Impact:** The timer is unreliable in exactly the scenario the app is designed for.

### P0-4 — `onComplete` fires from inside a `setState` updater and can fire repeatedly
**File:** `hooks/useRAFTimer.ts:53-62`

Completion is detected inside the `setTimeRemaining` updater: `if (newTime === 0 && isRunning) onComplete?.()`. Two defects:
1. **Side effects inside a state updater** run twice under React StrictMode and are a documented anti-pattern.
2. **No latch.** Once `newTime` reaches 0, `isRunning` is still true and rAF keeps scheduling frames; each subsequent frame re-enters with `prev === 0`, `newTime === 0`, and calls `onComplete` again. `handlePhaseComplete` (`useWorkoutEngine.ts:81-100`) advances the phase and resets, but the window between the first `onComplete` and the state settling allows **double phase transitions** (e.g. skipping a round or jumping REST→ROUND twice).

**Impact:** Non-deterministic phase transitions and duplicated announcements/bells at every boundary.

---

## 3. Critical Issues (P1)

### P1-1 — Per-round durations are ignored
**File:** `hooks/useWorkoutEngine.ts:49-60`
`getPhaseSeconds()` returns `workout.roundDuration` / `workout.restDuration` (workout-level) for **every** round. Each `Round` carries its own `drillDuration` and `restDuration` (`types/workout.ts:14-15`, populated in seed data) which are never consulted. Variable-length rounds are impossible, and the round-preview UI (`RoundPreview.tsx:23`) displays per-round times that the engine will not honor.

### P1-2 — Countdown announcements will spam once coaching is fixed
**Files:** `hooks/useWorkoutEngine.ts:153`, `lib/coaching-manager.ts:95-105`
The engine exposes `timeRemaining: Math.ceil(timeRemaining)`. `checkCountdown` speaks whenever `announceOnSeconds.includes(timeRemaining)` with **no per-second dedup** (unlike `checkCoachingCues`, which latches via `spokenCues`). Because the effect re-runs on every rAF frame and `ceil` holds an integer for ~1s of frames, each of "10,5,4,3,2,1" would be enqueued dozens of times. `useSpeechCoach` does not dedup by text (`useSpeechCoach.ts:121-138`), so the queue floods. (Latent today only because P0-1 keeps the manager null.)

### P1-3 — `asChild` is silently ignored → invalid nested interactive elements
**Files:** `components/ui/button.tsx:43-56`; used at `HomeScreen.tsx:34,43,48`, `TodayWorkoutCard.tsx:52`, `WorkoutDetail.tsx:81`, `WorkoutCard.tsx:56`, `FinishScreen.tsx:89`
The `Button` wraps base-ui's `Button`, which composes via a `render` prop, **not** `asChild` (a Radix idiom). Passing `asChild` does nothing, so `<Link><Button asChild><span/></Button></Link>` renders `<a><button><span/></button></a>` — a `<button>` nested inside an `<a>`. This is invalid HTML and a WCAG failure (nested interactive controls; unpredictable keyboard/AT behavior). It is also the source of 6 of the 9 TypeScript errors.

### P1-4 — TypeScript errors are suppressed and the tree does not type-check
**Files:** `next.config.mjs:3-5`, plus `tsc` output
`typescript.ignoreBuildErrors: true` ships a build that does not compile cleanly. `npx tsc --noEmit` reports **9 errors**, including `app/page.tsx:21` (`Workout | null` not assignable to `Workout | undefined`) and `hooks/useWorkoutBuilder.ts:6` (see P1-5). Suppression means regressions land invisibly.

### P1-5 — Runtime crash in the workout builder (`import { v4 } from 'crypto'`)
**File:** `hooks/useWorkoutBuilder.ts:6`
`import { v4 as uuidv4 } from 'crypto'` — Node's `crypto` module has no `v4` export (that's the `uuid` package's API), and `crypto` is a Node builtin being imported into a `'use client'` module. Any call to `createEmptyRound()`/`createEmptyWorkout()` throws `uuidv4 is not a function`. Only latent because the builder is never routed (see P2-1); it becomes a hard P0 the moment the feature is wired. Fix is `crypto.randomUUID()`.

### P1-6 — Engine runs against `{} as any` before the workout loads
**File:** `app/(routes)/workout/[id]/active/page.tsx:29-32`
`useWorkoutEngine({ workout: workout || ({} as any) })` runs all engine hooks with an empty object while the workout resolves. `getPhaseSeconds()` reads `undefined.roundDuration` → `NaN` flows into `reset()` and the rAF math. The render guards later (`:156`), but the hook has already initialized with garbage; this is fragile and defeats the type system with `as any`.

### P1-7 — Redundant, racing timer resets on phase change
**Files:** `hooks/useWorkoutEngine.ts:81-121`
The timer is reset in three places: inside `onComplete`/`handlePhaseComplete` (`:86,92`), inside a separate `useEffect` on phase change (`:113-121`), and again via `useRAFTimer`'s own `initialSeconds` effect (`useRAFTimer.ts:69-80`). These overlap and can double-reset or reset to the wrong duration during the completion race (P0-4). The phase machine needs a single owner of "set the clock for this phase."

### P1-8 — Zoom disabled (WCAG 1.4.4)
**File:** `app/layout.tsx:19-26`
`maximumScale: 1, userScalable: false` disables pinch-zoom. This fails WCAG 2.1 SC 1.4.4 (Resize Text) and is user-hostile for anyone with low vision.

### P1-9 — Missing ARIA semantics for the live timer and controls
**Files:** `components/Workout/Countdown.tsx:17-21`, `app/(routes)/settings/page.tsx:44-76,83-108`, `FinishScreen.tsx:63-77`
- The countdown is a bare `<div>` with no `aria-live`/`role="timer"`; screen-reader users get no updates and (P0-1 aside) no spoken coaching either.
- The Speech/Bells toggles are `<button>`s styled as switches with **no `role="switch"`, no `aria-checked`, no label** (`settings/page.tsx:44,64`).
- Range sliders' `<label>`s are not associated (`htmlFor`/`id`) with the inputs (`:80-91,97-108`).
- Star-rating buttons have no `aria-label` and use `focus:outline-none` with no replacement focus ring (`FinishScreen.tsx:64-67`).

### P1-10 — Destructive "Quit" has no confirmation
**Files:** `components/Workout/Controls.tsx:44-52`, `active/page.tsx:150-154`
A single tap on **Quit** immediately cancels speech, tears down the engine, and routes to `/` — mid-workout, no confirm. Easy to hit accidentally on a sweaty phone; the whole session is lost (and not recorded).

---

## 4. Major Issues (P2)

### P2-1 — Entire feature areas are built but never wired
- **Workout builder** (`hooks/useWorkoutBuilder.ts`, 173 LOC) — no `/create` or `/builder` route imports it.
- **Custom workouts** (`hooks/useCustomWorkouts.ts`, `hooks/useWorkoutLibrary.ts`) — never used by any page; the library page uses `useWorkout` (seed data only), so custom workouts can never appear.
- **"Today's workout"** (`app/page.tsx:8-11`) reads `selectedWorkoutId` from localStorage, but **nothing ever writes it** (confirmed: only reads exist). The home hero is permanently empty.
- **History** (`app/(routes)/history/page.tsx`) is a static "No completed workouts yet" placeholder; sessions are never persisted despite the `WorkoutSession` type existing.
- **Standalone rest route** (`app/(routes)/workout/rest/page.tsx`) uses `useTimer`, which by its own docstring "does not execute countdown logic" (`hooks/useTimer.ts:11-13`) — the timer never moves. The route is orphaned (rest is handled inside the active flow).

### P2-2 — Duplicate / dead modules
- **Two timer hooks:** `useRAFTimer` (real) and `useTimer` (a non-functional UI-state stub, `useTimer.ts:11-13`).
- **Two speech hooks:** `useSpeech` (used by the engine but disabled via `speechEnabled: false`, `active/page.tsx:31`) and `useSpeechCoach` (used by the page). One should be deleted.
- **Two workout data sources:** `data/seeded-workouts.ts` (used) and `data/workouts.json` (395 lines, imported nowhere — dead).
- **Two `validateWorkout` implementations** with different semantics: `lib/validation.ts` (rich) and `lib/workouts.ts:16-25` (boolean). `useWorkout.selectWorkout` uses the boolean one; the builder uses the rich one.

### P2-3 — Everything is a Client Component; no RSC benefit
Every route and component is `'use client'`. Workout data is fully static (`data/seeded-workouts.ts`) and could be served from Server Components / `generateStaticParams`, shrinking the JS bundle and improving first load. Only the interactive workout runner genuinely needs the client.

### P2-4 — Re-renders the whole active screen 60×/second
`useRAFTimer` calls `setTimeRemaining` every animation frame (`useRAFTimer.ts:53`), re-rendering `ActiveWorkoutPage → WorkoutScreen → RoundNumber/Countdown/CoachingCues/Controls` ~60fps, even though the displayed value (`Math.ceil`) changes once per second. No `React.memo`, no throttling to 1Hz for text, no decoupling of the animation clock from React state.

### P2-5 — No tests of any kind
No unit, integration, or e2e tests. The highest-risk logic — timer math, the phase machine, cue timing, `formatting`, `validation` — is entirely unverified. This is the root cause of how P0-1/P0-2 shipped.

### P2-6 — No linting / formatting / CI enforcement
`package.json` has `"lint": "eslint ."` but there is **no ESLint config** in the repo, so linting is effectively a no-op. No Prettier config, no CI workflow, no pre-commit hooks.

### P2-7 — localStorage layer has no schema validation or versioning
`useLocalStorage` does `JSON.parse` and trusts the shape (`useLocalStorage.ts:14-22`). Corrupt/old-shape data (e.g. `Date` fields in `CustomWorkout` serialize to strings and never rehydrate to `Date`) silently produces malformed state. No schema (e.g. Zod) and no migration/version key.

### P2-8 — Dependency hygiene
`shadcn` (a CLI/codegen tool) is listed as a runtime `dependency`, not a devDependency. `lucide-react: ^1.16.0` is a suspicious major (the ecosystem package is `0.x`) — verify the right package/version resolves. `@vercel/analytics` is loaded but only mounts in production (fine).

### P2-9 — Settings that don't do anything
The **Rest Warning** selector calls `updateVoiceSettings(...)` on click (`settings/page.tsx:127-129`) instead of setting `restWarning`, so the buttons never change the value and the preference is never consumed anywhere in the engine. The page footer says "Corner **v2.0**" while `package.json` says `0.1.0`.

### P2-10 — No error boundaries; ad-hoc error UI
Errors are surfaced as inline strings per page. There is no React error boundary, so a throw in the engine (e.g. P1-6 NaN paths) white-screens the route.

### P2-11 — Debug artifacts and generator residue left in
`console.error('[v0] ...')` tags throughout (`audio.ts:46`, `useWorkout.ts:18`, `useLocalStorage.ts:20,33`), `generator: 'v0.app'` metadata (`layout.tsx:8`). Fine for a prototype, not for production.

---

## 5. Minor Issues (P3)

- **P3-1** Unused type surface: `TimerState`, `WorkoutSession`, `AppState`, `CustomWorkout` (`types/workout.ts:43-88`) and `workout.totalDuration` are defined but unused/unpopulated.
- **P3-2** Magic numbers: default round `180` appears in `coaching-manager.ts:71` and `useWorkoutBuilder.ts:13`; no shared constant.
- **P3-3** State is passed between routes via URL query strings (`/finish?...`, `/workout/rest?...`) instead of a store, which is brittle and stringly-typed (and is the mechanism behind P0-2).
- **P3-4** `usePreferences` exposes `volume`, `theme`, `restWarning` that no runtime code reads; the app is hard-locked to dark (`layout.tsx:34`).
- **P3-5** Inconsistent semicolons/quote styles and mixed file naming (PascalCase components vs. kebab lib files) — cosmetic, but a formatter would settle it.
- **P3-6** `useSpeechCoach` sorts and mutates `queueRef.current` in an effect (`useSpeechCoach.ts:87-88`); priority handling is coarse and there's no max-queue guard.
- **P3-7** `formatRoundTime` (`lib/formatting.ts:17-20`) computes total time as `(round+rest)*count - rest`, ignoring per-round durations (consistent with P1-1) — will be wrong once rounds vary.

---

## 6. Dimension-by-dimension assessment

| Dimension | Grade | Notes |
|---|---|---|
| **Architecture** | C− | Clean folders, but a phase machine split awkwardly across a hook + a page's effects + a manager class; three overlapping reset paths; static data forced through client hooks. |
| **Code quality** | C | Readable and consistent locally, but duplicated hooks/data, `as any`, suppressed type errors, dead modules. |
| **Accessibility** | D | Zoom disabled, no live region for the timer, unlabeled switches/sliders, nested interactive elements, no focus-visible on some controls. |
| **State management** | C− | Reasonable local hooks, but no single source of truth for a running workout; cross-route state via query strings; localStorage without validation; `selectedWorkoutId` write path missing. |
| **Speech implementation** | D (F in practice) | Well-intentioned queue/priority design, but **not invoked at all** (P0-1); two competing hooks; no dedup on countdowns; pause/resume relies on flaky `SpeechSynthesis.pause()`. |
| **Timer accuracy** | D | rAF-only, freezes on screen sleep (P0-3), completion double-fire (P0-4), per-round durations ignored (P1-1). |
| **UI/UX** | B− | Genuinely nice, focused, high-contrast dark design; but broken finish stats, empty home hero, no quit confirmation, dead nav targets undercut it. |
| **Performance** | C | 60fps whole-tree re-renders; all-client bundle; unoptimized images flag; otherwise small app so absolute cost is low. |
| **Maintainability** | C− | No tests, no lint, suppressed types, dead code, no README/CI. Small size keeps it tractable. |
| **Testing** | F | None. |

---

## 7. Positives worth preserving

- Clear domain model (`types/workout.ts`) and a sensible `Workout → Round → CoachingCue` hierarchy.
- Good component decomposition (presentational `WorkoutScreen`/`Countdown`/`Controls` are clean and reusable).
- Thoughtful, product-aligned visual design (calm dark theme, oversized timer, minimal chrome).
- The *intent* behind the speech queue (priority + dedup + pause) and the Web Audio bell synthesis is the right approach — it just needs to be wired and consolidated.
- Rich seed content already written (`data/seeded-workouts.ts`).

---

## 8. Recommended immediate actions (this week)

1. **Fix the core loop (P0-1 → P0-4)** so a workout actually coaches, finishes with real stats, keeps the screen awake, and transitions phases deterministically. This is the difference between "demo" and "usable."
2. **Turn off error suppression** (`ignoreBuildErrors`) and clear the 9 type errors, starting with the `asChild`/Button contract (P1-3, P1-4).
3. **Add a smoke test** for the timer math and phase machine so P0s cannot silently regress.

See `ROADMAP.md` for the phased plan and `ARCHITECTURE.md` for the target design.
