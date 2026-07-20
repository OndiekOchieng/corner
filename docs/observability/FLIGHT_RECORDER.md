# Flight Recorder — the workout remembers (PR-032)

> The Engine owns time. The Bell owns beginnings and endings. The Coach owns
> behaviour. Silence owns presence. The Athlete owns the experience.
> **The Flight Recorder owns nothing. It merely remembers.**

The Flight Recorder turns the workout's own event stream into an honest, beautiful,
temporally-correct **story of itself** — so that when an athlete says *"Competition felt
strange today"*, we can ask *"tell me the story of your workout"* instead of *"send us
screenshots and console logs."*

It is **not** a runtime, a manager, an owner of state, or a new abstraction. It is one
small, parasitic observer.

## Architecture — parasitic by construction

```
                         EventBus  (engine events already flow here)
                              │  priority order
     Coach (100) ─ Media (40) ─ Persistence ─ …
                              │
     FlightRecorder (1000) ───┘   subscribes → append()
        └── observeSpeech(sink) ── decorates the coach's SpeechSink → append()
                              │
                          export()  →  markdown story
```

Two taps, both onto things that **already exist** — nothing was added anywhere solely to
feed the recorder:

1. **An Event Runtime `Subscriber`** (like the Coach and Media plugins) at **priority
   1000** — highest, so it stamps the current moment *before* anyone reacts. It reads the
   workout's shape (started, rounds, rests, bells-by-proxy, pause/resume, complete). It
   never mutates an event and has no side effect on the runtime.
2. **A transparent `SpeechSink` decorator** — `observeSpeech(sink)` returns a wrapper that
   records what the coach *actually said* and forwards every call unchanged. It observes;
   it never controls.

The recorder appears in `useCoachedWorkout` only at the composition edge: it wraps the
sink handed to the coach and registers on the bus. The Engine, Coach, and Media Runtime do
not know it exists.

## What it records — stories, not states

| Source | Event | Story line |
|---|---|---|
| bus | `WORKOUT_STARTED` | `Workout started.` |
| bus | `WARMUP_STARTED` | `Warm-up started.` |
| bus | `ROUND_STARTED` (n=1) | `Opening bell. Round 1 started — {name}.` |
| bus | `ROUND_STARTED` (n>1) | `Bell. Round {n} started — {name}.` |
| bus | `ROUND_COMPLETED` | `Round {n} completed.` |
| bus | `REST_STARTED` | `Rest. Next up: {next}.` |
| bus | `WORKOUT_PAUSED` / `RESUMED` | `Paused.` / `Resumed.` |
| bus | `WORKOUT_COMPLETED` | `Final bell. Workout complete.` |
| bus | `WORKOUT_CANCELLED` | `Workout ended early.` |
| sink | every `speak(text)` | `Coach: {text}` |

**Deliberately omitted** (Principle #3 — never numbers, never noise):
- `COUNTDOWN_STARTED` / `COUNTDOWN_SECOND` — the coach no longer counts (PR-030); numbers
  are not a story.
- `COACH_CUE` — the *scheduled* cue is not the story; `observeSpeech` records what was
  actually **said** (reinforced, rendered per pack, or dropped by the silence gate).
- `WARMUP_COMPLETED` / `REST_COMPLETED` — the next "started" line already tells it.
- Wake lock, visibility, and the raw bell are **media-internal** — not workout events on
  the bus. The bell is captured *by proxy* (it fires on the round/rest/complete lines the
  recorder already tells). Surfacing wake-lock/visibility would mean tapping media
  internals; it is intentionally out of scope for this PR (see [Future](#future-products)).

Time is the engine's deterministic `elapsedMs`, formatted `m:ss` (or `h:mm:ss`), so the
story is reproducible and never touches a wall clock.

## Example — a real session (default coach, seeded 3-round workout)

```
# Workout Story — Orthodox Power
- `0:00`  Workout started.
- `0:00`  Coach: Alright. Orthodox Power. Let's work.
- `0:00`  Warm-up started.
- `0:00`  Coach: Warm up. Get loose, get sharp.
- `0:04`  Opening bell. Round 1 started — Jab.
- `0:10`  Coach: Jab
- `0:16`  Round 1 completed.
- `0:16`  Coach: Good. Own the range.
- `0:16`  Rest. Next up: Cross.
- `0:19`  Bell. Round 2 started — Cross.
- `0:19`  Coach: Round 2. Cross — let me see those hands.
- …
- `0:46`  Final bell. Workout complete.
- `0:46`  Coach: That's a fighter's session. 3 rounds, you dug deep. Respect.
```

## Export format — markdown (recommended)

Markdown, because it is the most *Corner* choice: human-readable at a glance, pasteable
into an issue or a message, honest, and beautiful without a viewer. `entries()` exposes the
same moments as structured `StoryMoment[]` for anyone who wants JSON — but the story is
authored as prose, not a table of counters.

## Surface — dev only

The story is exposed via `useCoachedWorkout().getStory()` and reachable from the dev
diagnostics overlay ("copy story" → clipboard + console). It ships **only** in development
(the overlay is stripped from production). This PR introduces **no** History, analytics,
statistics, achievements, progress tracking, cloud storage, or sharing — only the Flight
Recorder.

## The seven questions

1. **What already exists that can be subscribed to?** The engine `EventBus` (the workout's
   shape) and the coach's `SpeechSink` (its voice). Nothing new was created to feed it.
2. **Can it remain completely parasitic?** Yes — one bus subscriber + one transparent sink
   decorator; it mutates nothing and controls nothing.
3. **Can it remain a single component?** Yes — one class, `FlightRecorder`.
4. **Can it avoid introducing ownership?** Yes — it owns no time, session, round, speech,
   wake lock, personality, or timer. It holds only a list of remembered lines.
5. **Can it naturally become the story of a workout?** Yes — see the example; it reads as a
   narrative, in engine time, in the coach's real words.
6. **Does it improve future investigations?** Yes — a strange session can be *retold*
   ("tell me the story") instead of reconstructed from screenshots and logs. It is the
   memory the immersion/personality investigations (INV-001/002) were missing.
7. **Can future products benefit without modifying it?** Yes — any product built on the same
   event stream gets a story for free. New event types simply need a line in `narrate()`;
   the recorder itself doesn't change per product.

## Boundaries honoured

No new runtime/manager/coordinator. No ownership. Nothing exists solely for the recorder.
No History/analytics/statistics/achievements/cloud/sharing. It is one of the least
interesting pieces of engineering in Corner — and one of the most valuable pieces of memory
it now possesses.
