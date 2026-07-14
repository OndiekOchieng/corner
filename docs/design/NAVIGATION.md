# Navigation (PR-024)

Navigation in Corner should almost disappear. The athlete notices the content — the
title, the timer, the coach — not the controls. This document is the north star for
how we move between screens.

> Calm. Minimal. Purposeful. Moving between *training spaces*, not browsing a website.

---

## Philosophy

- **The page title is the hero.** Navigation is an eyebrow above it, never a competing
  row.
- **Navigation is quieter than content** — subtle typography, muted colour, generous
  whitespace.
- **No chrome we don't need** — no floating buttons, no persistent bottom bar, no
  browser-style back. Corner is a focused coaching experience, not a content app.
- **Explicit destinations.** We name where "up" goes ("Home", "Library") — never a
  generic "Back".
- **OS gestures are welcome, never required.** iOS swipe-back and Android back keep
  working; the visible affordance is the accessible counterpart, not the only way.

## Hub-and-spoke model

Corner is shallow. Home is the hub; everything returns to it.

```
                 ┌──────── Home (/) ────────┐        hub · root · no up-link
                 ▼           ▼               ▼
             Library     Settings        History      spokes · up → Home
                 ▼
          Workout Detail                                spoke · up → Library
                 ▼
          Active Workout ──▶ Finish ──▶ Home            protected flow · forward only
```

- **Settings and History belong to Home** → `← Home`.
- **Workout Detail belongs to Library** → `← Library`.
- **Active Workout is protected** — no up-link at all (see below).
- **Finish moves forward** — its terminal action is **Home**, never Back. Once a
  session is complete, going "back" into it would be wrong.

## The `UpLink` component

One component, one visual language, used on every screen that has a parent
(`components/ui/UpLink.tsx`). It replaced two divergent implementations (the old
`BackLink` and a hand-rolled link on Workout Detail).

```
← Home            ← the eyebrow: small, muted, letter-spaced

Library           ← the title immediately owns the screen
Choose a session…
```

- **API:** `<UpLink href="/" label="Home" />` — the label is the destination, always.
- **Quiet by design:** `text-muted-foreground`, small, sits directly above the title.
- **Accessible:** a real link with `aria-label="Up to Home"`, a **≥44px touch
  target** (`min-h-11`), keyboard focus, and a visible focus ring.
- **Placement:** top-left eyebrow, inside the safe-area-aware `page-shell`, on Library,
  Settings, History, and Workout Detail — same place, every time.

## Protected workout flow

The Active screen carries **no navigation chrome** — the athlete is training. The only
actions are **Pause**, **Resume**, and **End workout**. But the OS back gesture and a
refresh could still tear them out mid-round, so `LeaveWorkoutGuard`
(`components/Workout/LeaveWorkoutGuard.tsx`) arms two guards while training:

- **Refresh / tab close** → a native `beforeunload` confirmation.
- **Back / swipe-back / Android back** → intercepted via `popstate`: the guard
  re-seeds a history entry and asks in-app instead of navigating away.

```
      OS back / swipe / Android back
                 │
                 ▼
        ┌───────────────────────────┐
        │  Leave workout?           │
        │  You're mid-session.      │
        │  Ending now won't be      │
        │  saved to your History.   │
        │                           │
        │  [ Continue training ]    │  ← primary, focused, Escape = this
        │  [ End workout ]          │  ← runs the normal quit flow
        └───────────────────────────┘
```

- **Continue training** (or `Escape`) simply dismisses — the athlete stays in the
  workout.
- **End workout** runs the same quit flow as the on-screen End button and returns Home.
- The guard reacts only to a real leave attempt; there is still no visible back button.

> Copy note: the confirm says *"won't be saved to your History"* because a cancelled
> workout is intentionally discarded (a workout only enters History when completed — see
> the Session Runtime / PR-012). This is deliberately honest rather than the softer
> "your progress will be saved."

## Verification checklist

| Screen | Up-link | Notes |
|---|---|---|
| Home | — | the hub, no up-link |
| Library | `← Home` | eyebrow above the title |
| Workout Detail | `← Library` | title-owned header; stats breathe below |
| History | `← Home` | eyebrow |
| Settings | `← Home` | eyebrow |
| Active Workout | **none** | protected; Pause / Resume / End only |
| Finish | **none** | terminal action is Home (forward) |

One consistent `UpLink`. Consistent spacing. No duplicated implementations. Training
protected. The title always dominates.
