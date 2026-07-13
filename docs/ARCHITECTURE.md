# Corner — Target Architecture

**Status:** Proposed (companion to `AUDIT.md` and `ROADMAP.md`)
**Goal:** A reliable, accessible, testable coaching runner where a single clock and a single state machine drive the UI, audio, and speech — with static content served efficiently and persisted user data validated.

---

## 1. Guiding principles

1. **One clock.** A running workout has exactly one time source: a monotonic `performance.now()` anchor. Everything (display, cue timing, phase transitions) is *derived* from elapsed time, not accumulated per-frame.
2. **One state machine.** Phase transitions live in a single reducer/machine, not scattered across a hook, a page's effects, and a manager class.
3. **Events, not effect-polling.** The engine emits discrete events (`roundStart`, `cue`, `countdown`, `restStart`, `finish`); audio and speech *subscribe*. No component re-derives "did we cross a boundary?" from `timeRemaining` each render.
4. **Render only when the user-visible value changes.** The animation loop updates a ref/store; React re-renders at ~1 Hz for the digit display (and can subscribe separately for a smooth progress ring).
5. **Server by default, client where interactive.** Static workout content is a Server Component concern; only the runner is `'use client'`.
6. **Typed, validated boundaries.** All persisted/URL data crosses a Zod-validated boundary with versioning.

---

## 2. Current architecture (as-is)

```
app/page.tsx (client) ──► useWorkout ──► lib/workouts ──► data/seeded-workouts.ts
                          useLocalStorage('selectedWorkoutId')   ← never written

app/workout/[id]/active/page.tsx (client)
   ├─ useWorkout.loadWorkoutById
   ├─ usePreferences ─ useLocalStorage
   ├─ useWorkoutEngine ──┬─ useRAFTimer      (setState @60fps, onComplete in updater)
   │                     └─ useSpeech        (DISABLED via speechEnabled:false)
   ├─ useSpeechCoach     (separate queue)
   ├─ CoachingManager    (constructed only on WARMUP → never)     ◄── dead
   ├─ 6× useEffect polling engine.phase/timeRemaining
   └─ lib/audio bells
        navigate ► /finish?workoutId=…   ►  FinishScreen reads workoutName/duration/… ◄── mismatch
```

Problems this shape creates (see `AUDIT.md`): duplicated timers/speech, effect-based boundary detection that spams, a manager gated on an unreachable phase, per-frame re-renders, cross-route state via query strings, and no single owner of "the current phase's duration."

---

## 3. Target architecture (to-be)

### 3.1 Layered view

```
┌──────────────────────────────────────────────────────────────┐
│ Routes (app/)                                                  │
│  • Static/content routes = Server Components (RSC)             │
│  • /workout/[id]/run     = thin client container              │
└───────────────┬──────────────────────────────────────────────┘
                │ props / context
┌───────────────▼──────────────────────────────────────────────┐
│ Presentation (components/)  — pure, memoized, a11y-first       │
│  WorkoutRunnerView · Countdown(role=timer) · Controls · Cues   │
└───────────────┬──────────────────────────────────────────────┘
                │ selectors / callbacks
┌───────────────▼──────────────────────────────────────────────┐
│ Application (hooks/)                                           │
│  useWorkoutRunner()  ── orchestrates:                          │
│    • workoutMachine (reducer)   ◄── single source of truth     │
│    • useClock()                 ── one rAF anchored to now()   │
│    • useWakeLock()              ── keep screen awake           │
│    • AudioCoordinator           ── subscribes to engine events │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Domain (lib/) — framework-free, 100% unit-testable            │
│  workout-machine.ts · timeline.ts (cue/countdown schedule)    │
│  speech-queue.ts · bells.ts · formatting.ts · validation.ts   │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ Data (data/ + repositories)                                   │
│  seededWorkouts (static) · workoutRepository (localStorage+Zod)│
│  sessionRepository (history) · preferencesRepository          │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 The workout machine (single source of truth)

A pure reducer, no React:

```
State = {
  phase: 'idle' | 'countIn' | 'round' | 'rest' | 'finished'
  roundIndex: number            // 0-based
  phaseStartedAt: number        // performance.now() anchor
  phaseDurationMs: number       // from THIS round (round.drillDuration / round.restDuration)
  status: 'running' | 'paused'
  pausedAccumMs: number         // total time spent paused this phase
}

Events: START, TICK(nowMs), PAUSE(nowMs), RESUME(nowMs), SKIP, QUIT, COMPLETE_PHASE

Derived (selectors, not stored):
  elapsedMs(now)      = now - phaseStartedAt - pausedAccumMs
  remainingMs(now)    = max(0, phaseDurationMs - elapsedMs(now))
  displaySeconds(now) = ceil(remainingMs(now)/1000)
```

Transitions are total and deterministic; `COMPLETE_PHASE` is emitted **once** when `remainingMs` first hits 0 (latched by comparing previous vs. current tick), fixing P0-4 and P1-7. Per-round durations come from `round.drillDuration`/`round.restDuration`, fixing P1-1. A configurable `countIn` phase (3–2–1) replaces the vestigial `WARMUP` and gives the coach a real hook to announce the workout, fixing the structural cause of P0-1.

### 3.3 One clock

```ts
useClock(onTick: (nowMs: number) => void, running: boolean)
// - single requestAnimationFrame loop while running
// - calls onTick(performance.now()) each frame
// - reducer computes remaining from the now() anchor (immune to dropped frames)
// - on 'visibilitychange' → resync immediately (recompute from now())
// - the VIEW subscribes to displaySeconds via useSyncExternalStore and only
//   re-renders when the integer second changes (fixes P2-4)
```

Because state is anchored to `performance.now()`, a suspended tab/screen simply resumes with the correct remaining time on the next tick — combined with Wake Lock (below), the timer stays correct (fixes P0-3).

### 3.4 Wake lock

```ts
useWakeLock(active: boolean)
// navigator.wakeLock.request('screen') while a workout runs;
// re-acquire on visibilitychange (browsers drop the lock on blur);
// graceful no-op where unsupported.
```

### 3.5 Audio + speech coordinator (event-driven, consolidated)

Delete `useSpeech` (the disabled duplicate). Keep **one** speech queue, promoted to a framework-free `lib/speech-queue.ts` with: dedup by text within a short window, priority, cancel-on-pause/quit, and a bounded queue. A thin `useSpeechCoach` adapts it to React (voice loading, support detection).

The engine emits events; a single `AudioCoordinator` maps them to speech + bells:

```
engine.on('countIn',   n)   → speak(n)                 + (optional tick)
engine.on('roundStart', r)  → speak(`Round ${i}. ${r.name}. ${r.currentDrill}`) + roundBell
engine.on('cue',        c)  → speak(c.text)            // scheduled by timeline.ts, latched once
engine.on('countdown',  n)  → speak(n)                 // scheduled once per integer, fixes P1-2
engine.on('restStart',  r)  → speak('Rest. Next: '+r.name) + restBell
engine.on('finish',     s)  → speak('Workout complete…') + finishBell
```

Cue/countdown scheduling moves into a pure `timeline.ts` that, given a round, produces a sorted list of `{ atMs, event }` markers; the coordinator fires each marker exactly once as the clock crosses it. This replaces the six polling effects in `active/page.tsx` and the `CoachingManager` class, and removes all "within 1 second tolerance" heuristics (`coaching-manager.ts:85`).

### 3.6 Data & persistence

```
data/seeded-workouts.ts            → single source of static content (delete data/workouts.json)
lib/repositories/workoutRepository → custom workouts, localStorage + Zod + schemaVersion
lib/repositories/sessionRepository → completed WorkoutSession[] (enables real History)
lib/repositories/preferencesRepo   → UserPreferences, validated, with defaults/migration
```

- One `validateWorkout` (`lib/validation.ts`); delete the boolean duplicate in `lib/workouts.ts`.
- `CustomWorkout.createdAt/lastModified` stored as ISO strings; rehydrate through Zod (fixes the `Date` round-trip bug noted in P2-7).
- Cross-route state (finish summary) is passed via `sessionRepository` (write session on finish, read it on `/finish`) instead of query strings — fixes P0-2 at the root and enables History for free.

### 3.7 Custom workouts & builder

Wire `useWorkoutBuilder` to a real `/create` route, replace `import { v4 } from 'crypto'` with `crypto.randomUUID()` (P1-5), and have `useWorkoutLibrary` merge seeded + repository workouts so the library and "today's workout" actually reflect user content. Add the missing `selectedWorkoutId` **write** path (a "set as today" action) so `app/page.tsx` populates (P2-1).

---

## 4. Component & accessibility contract

- `Countdown` → `role="timer"` + `aria-live="assertive"`/`aria-atomic`, announcing at sensible intervals (not every second).
- Settings toggles → real `role="switch"` + `aria-checked` + associated label (or a shared `<Switch>` primitive).
- Sliders → `<label htmlFor>` bound to `id`; keep native `<input type=range>` (accessible by default).
- Restore pinch-zoom: drop `maximumScale`/`userScalable` (P1-8).
- Replace `asChild` misuse with base-ui's `render` prop, or render `<Link>` as the button directly, eliminating nested `<a><button>` (P1-3).
- Add an error boundary per route segment and a `<QuitConfirm>` dialog (P1-10).
- Provide `prefers-reduced-motion` handling for the timer/animations.

---

## 5. Tooling & quality gates

- **TypeScript:** remove `ignoreBuildErrors`; `tsc --noEmit` clean in CI.
- **Lint/format:** ESLint flat config (`next/core-web-vitals` + `jsx-a11y`) + Prettier.
- **Tests:**
  - *Unit (Vitest):* `workout-machine`, `timeline`, `formatting`, `validation`, `speech-queue` — deterministic, `now()` injected.
  - *Integration (RTL):* runner drives idle→finish with a fake clock; asserts events/announcements fire once each.
  - *E2E (Playwright):* start → coach speaks → finish shows real stats → history records.
- **CI:** typecheck + lint + test on every PR; block on failure.
- **Perf budget:** move static routes to RSC; keep the runner the only large client chunk.

---

## 6. Proposed target file layout

```
app/
  page.tsx                     (RSC) home + "today"
  workouts/page.tsx            (RSC) library (seed) + client filter island
  workout/[id]/page.tsx        (RSC) detail
  workout/[id]/run/page.tsx    (client) thin container → useWorkoutRunner
  create/page.tsx              (client) builder
  history/page.tsx             (client) sessionRepository
  finish/[sessionId]/page.tsx  reads persisted session
  settings/page.tsx
components/
  workout/ (RunnerView, Countdown, Controls, Cues, QuitConfirm)
  ui/ (Button[render-prop], Card, Switch, Slider)
hooks/
  useWorkoutRunner · useClock · useWakeLock · useSpeechCoach · usePreferences
lib/
  workout-machine.ts · timeline.ts · speech-queue.ts · bells.ts
  formatting.ts · validation.ts (single) · constants.ts
  repositories/ (workout · session · preferences)
data/ seeded-workouts.ts
types/ workout.ts
```

Deleted along the way: `hooks/useTimer.ts`, `hooks/useSpeech.ts`, `hooks/useRAFTimer.ts` (folded into `useClock`), `lib/coaching-manager.ts` (→ `timeline.ts` + coordinator), `data/workouts.json`, `app/workout/rest/*`, `components/Rest/*`, and the boolean `validateWorkout` in `lib/workouts.ts`.
