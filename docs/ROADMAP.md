# Corner — Implementation Roadmap

Companion to `AUDIT.md` (findings) and `ARCHITECTURE.md` (target design). Phases are ordered by risk: make the core loop *work and stay working* before adding features or polish. Effort estimates assume one experienced frontend engineer; they are relative sizing, not commitments.

**Legend:** effort `S` ≤0.5d · `M` ~1d · `L` ~2–3d. Severity references map to `AUDIT.md`.

---

## Phase 0 — Stabilize the core loop (BLOCKERS)
*Goal: a real workout coaches out loud, transitions deterministically, keeps the screen awake, and ends with correct stats. Target: ~3–4 days.*

| # | Task | Fixes | Effort |
|---|------|-------|--------|
| 0.1 | Introduce a `countIn` phase (replacing the unreachable `WARMUP`) and construct/attach the coaching lifecycle to a phase the engine actually enters; verify round intros, cues, rest, and completion all speak. | P0-1 | M |
| 0.2 | Persist the completed session and route `/finish` off a session id (or pass `workoutName/duration/roundsCompleted/totalRounds`); render real stats; persist rating/notes. | P0-2, P3-3 | M |
| 0.3 | Add `useWakeLock` (Screen Wake Lock) active while a workout runs; re-acquire on `visibilitychange`. | P0-3 | S |
| 0.4 | Anchor the timer to `performance.now()` and resync on `visibilitychange`; emit `COMPLETE_PHASE` exactly once via a tick-to-tick latch (move side effects out of the `setState` updater). | P0-3, P0-4 | M |
| 0.5 | Add a smoke test (fake clock) proving idle→countIn→round→rest→…→finished fires each boundary once. | prevents regressions of P0-1/2/4 | S |

**Exit criteria:** Start a seeded workout on a phone → hear the coach, screen stays on, phases advance cleanly, finish screen shows correct duration/rounds. Smoke test green.

---

## Phase 1 — Correctness, accessibility & type safety (CRITICAL)
*Goal: the engine is right, the app type-checks, and it's usable with assistive tech. Target: ~1 week.*

| # | Task | Fixes | Effort |
|---|------|-------|--------|
| 1.1 | Extract the phase logic into a pure `workout-machine.ts` reducer + `timeline.ts` cue/countdown schedule; retire the three overlapping reset paths. | P1-7, arch | L |
| 1.2 | Honor per-round `drillDuration`/`restDuration`; update `formatRoundTime`. | P1-1, P3-7 | S |
| 1.3 | Latch countdown announcements once per integer second; consolidate to a single speech queue (delete `useSpeech`). | P1-2, P2-2 | M |
| 1.4 | Fix the `Button`/`asChild` contract (use base-ui `render`, or render `Link` as the control) — removes nested `<a><button>` everywhere. | P1-3, P1-9 | M |
| 1.5 | Set `next.config` `ignoreBuildErrors: false`; clear all 9 `tsc` errors; remove `as any` on the engine's workout prop and guard the loading state. | P1-4, P1-6 | M |
| 1.6 | Accessibility pass: `role="timer"`+`aria-live` on the countdown; `role="switch"`+`aria-checked`+labels on toggles; associate slider labels; restore focus rings on star buttons; re-enable pinch-zoom. | P1-8, P1-9 | M |
| 1.7 | Add a Quit confirmation dialog. | P1-10 | S |
| 1.8 | Add an error boundary per route segment. | P2-10 | S |

**Exit criteria:** `tsc --noEmit` and lint clean; keyboard/screen-reader can run and understand a workout; variable-length rounds work; no duplicate announcements.

---

## Phase 2 — Complete & wire the built-but-dead features (MAJOR)
*Goal: the features already coded actually reach users. Target: ~1–2 weeks.*

| # | Task | Fixes | Effort |
|---|------|-------|--------|
| 2.1 | Add a `workoutRepository` (localStorage + Zod + `schemaVersion`); wire `useWorkoutLibrary` to merge seeded + custom so custom workouts appear in the library. | P2-1, P2-7 | M |
| 2.2 | Add the `/create` builder route; replace `import { v4 } from 'crypto'` with `crypto.randomUUID()`; validate via the single `lib/validation.ts`. | P2-1, P1-5, P2-2 | L |
| 2.3 | Add a "Set as today" action that writes `selectedWorkoutId`, so the home hero populates. | P2-1 | S |
| 2.4 | Implement `sessionRepository` + a real History page from persisted sessions. | P2-1 | M |
| 2.5 | Make the Rest-Warning setting (and any other exposed prefs) actually affect the engine; fix the version string. | P2-9, P3-4 | S |
| 2.6 | Delete dead code: `useTimer`, `data/workouts.json`, `/workout/rest` route + `RestScreen`, boolean `validateWorkout`, unused types. | P2-2, P3-1 | S |
| 2.7 | Move static content routes (home, library, detail) to Server Components; keep only the runner + builder as client. | P2-3 | M |

**Exit criteria:** Create a custom workout → it appears in the library → set as today → run it → it lands in History with rating/notes. No orphaned routes/hooks remain.

---

## Phase 3 — Hardening, performance & engineering hygiene (QUALITY)
*Goal: it stays correct and fast, and changes are safe to ship. Target: ongoing.*

| # | Task | Fixes | Effort |
|---|------|-------|--------|
| 3.1 | Add ESLint flat config (`next/core-web-vitals` + `jsx-a11y`) + Prettier + a CI workflow (typecheck + lint + test on PR). | P2-6 | M |
| 3.2 | Unit tests: `workout-machine`, `timeline`, `formatting`, `validation`, `speech-queue`. Integration (RTL) for the runner with a fake clock. One Playwright happy-path e2e. | P2-5 | L |
| 3.3 | Decouple the animation clock from React: update via a store, re-render text at ~1 Hz; `React.memo` the presentational runner components. | P2-4 | M |
| 3.4 | Remove `[v0]` debug logging / generator residue; add a light logging util. | P2-11 | S |
| 3.5 | Dependency hygiene: move `shadcn` to devDependencies; verify `lucide-react` version resolves the intended package. | P2-8 | S |
| 3.6 | PWA polish: offline-capable manifest, `prefers-reduced-motion`, and image optimization (drop `images.unoptimized` where feasible). | P2-3, UX | M |
| 3.7 | Write a `README` (setup, architecture pointer, scripts) and this docs set into the repo root reference. | maintainability | S |

**Exit criteria:** Green CI gate on every PR; test coverage on all domain logic; steady 1 Hz text updates under profiling; no dead code or debug residue.

---

## Sequencing notes & dependencies

- **Do Phase 0 before anything else** — it's the difference between a broken demo and a usable app, and 0.4/0.1 unblock the clean architecture in Phase 1.
- **1.1 (extract the machine) is the keystone.** It pays down the structural debt behind P0-1, P0-4, P1-2, and P1-7 in one move; sequence 1.2/1.3 on top of it.
- **1.5 (un-suppress types)** should land early in Phase 1 so the rest of the phase can't reintroduce type debt.
- **2.7 (RSC migration)** is safe only after the runner's client boundary is well-defined (Phase 1) — don't attempt it earlier.
- **3.2 (tests)** can begin in parallel with Phase 1 (start with the pure `lib/` modules as they're extracted) rather than waiting for Phase 3.

## Suggested milestones

| Milestone | Contains | Outcome |
|---|---|---|
| **M1 — "Coaches correctly"** | Phase 0 | Core workout loop works end-to-end on a phone. |
| **M2 — "Correct & accessible"** | Phase 1 | Type-clean, a11y-compliant, deterministic engine. |
| **M3 — "Feature-complete"** | Phase 2 | Custom workouts, history, and home all live. |
| **M4 — "Production-hardened"** | Phase 3 | CI, tests, perf, PWA, clean repo. |
