# DESIGN_SYSTEM.md — Corner's Visual Language

One cohesive system so every screen feels like the same premium product. The goal is **premium sports equipment, not a dashboard**: calm, dark, confident, quiet until the moment demands attention. This documents the tokens and rules; the implementation lives in `app/globals.css` and the shared components.

> Principles: **Calm · Confidence · Focus · Readability · Hands-free · Trust.** If a visual choice doesn't serve one of these, it doesn't ship.

---

## 1. Color

Dark-first, near-monochrome, with colour reserved for *meaning*. Tokens are OKLCH for perceptual consistency. The base palette (`--background`, `--card`, `--foreground`, `--muted`, `--border`, etc.) is unchanged from the existing theme; PR-008 adds a **phase state palette** and **elevation/motion** tokens.

### Base (unchanged)
| Token | Value (OKLCH) | Use |
|---|---|---|
| `--background` | `0.08 0 0` | app canvas — near-black |
| `--card` | `0.12 0 0` | raised surfaces |
| `--foreground` | `0.95 0 0` | primary text / work timer |
| `--muted-foreground` | `0.65 0 0` | secondary text, eyebrows |
| `--border` | `0.2 0 0` | hairlines, dividers |
| `--primary` | `0.95 0 0` | primary buttons (bright neutral) |

### Phase state palette (new)
Colour carries the *phase* of the workout. **Never colour-only** — every state also carries a text label, so it survives colour-blindness and glance-reading.

| Token | Value | Meaning | Where |
|---|---|---|---|
| `--work` | `0.96 0 0` (bright neutral) | in the round, focus on the bag | active timer, work label |
| `--rest` | `0.72 0.11 195` (cool teal) | recovering — unmistakably *not* work | rest timer, rest labels, next-round ring |
| `--push` | `0.62 0.21 25` (corner red) | final-10 / urgency — used sparingly so it always means "now" | countdown, focus rings, quit-hover |
| `--success` | `0.74 0.15 155` (green) | the honest close | finish accents, rating fill |

**Rule — red is precious.** `--push` appears only at genuine urgency (the final-10 countdown, destructive intent, focus rings). If red is everywhere, it means nothing. Work is calm neutral; rest is cool; the session only "goes red" when it counts.

**Difficulty tags** keep the existing `DIFFICULTY_COLORS` (blue/orange/red-900 tints) — low-saturation, informational, never competing with the state palette.

---

## 2. Typography

System font stack (no web-font load — instant, calm, native-feeling). Weight and size do the work; we lean on a small set of roles.

| Role | Spec | Use |
|---|---|---|
| `timer-hero` | mono, bold, `clamp(6rem, 34vmin, 18rem)`, tabular, `line-height 0.9` | the active workout timer |
| `timer-lg` | mono, bold, `clamp(4rem, 20vmin, 8rem)`, tabular | standalone rest timer |
| Display `h1` | `text-4xl`–`5xl`, bold, tight tracking, `text-balance` | screen titles, workout names |
| `h2`/`h3` | `text-xl`–`2xl`, bold | section + card titles |
| `coaching-cue` | `text-2xl`, semibold, snug, `text-balance` | the on-screen cue |
| Body | `text-base`/`text-sm`, `muted-foreground` | descriptions |
| `eyebrow` | `text-xs`, medium, uppercase, `tracking-[0.18em]`, muted | the quiet label above a value |

**Rules:**
- **Tabular figures everywhere numbers change** (`tabular-nums`) — the timer never jitters, stats never shift width.
- **`text-balance`** on headings and cues — no orphan words, cleaner ragged edge.
- The **eyebrow** is the workhorse of hierarchy: it lets a value stand large and unlabelled-looking while still being labelled. Used on every stat, card, and section.

---

## 3. Spacing & layout

Tailwind's 4px scale. Conventions that make screens feel composed rather than assembled:

- **Screen padding:** `px-5` mobile, `md:px-8`; vertical `py-10`–`py-12`.
- **Section rhythm:** `space-y-8` between setting groups / major sections; `gap-3`–`gap-4` within a group.
- **Content width:** `max-w-2xl` for reading/setup screens, `max-w-6xl` for the library grid.
- **`.screen`** utility: `min-height: 100svh` + safe-area insets on all four sides — the standard wrapper for full-height screens (essential for a phone on the floor).

---

## 4. Radius & elevation

| Token | Value | Use |
|---|---|---|
| `--radius` | `0.75rem` (raised from 0.5) | base; softer, more premium |
| card / control | `rounded-2xl` (~1.35rem) | cards, large buttons, inputs |
| hero surfaces | `rounded-3xl` | today-card, history empty state |
| pill / tag | `rounded-full` | difficulty/stance tags, toggles, dots |

**Elevation** is soft and physical, never a hard "material" shadow:
- `--elevation-1` — resting cards (`elevate-1`).
- `--elevation-2` — hero surfaces and hover (`elevate-2`).
- `--elevation-focus` — the push-tinted focus glow.

Surfaces are further separated by a **1px `ring-foreground/10`** rather than heavy borders — quieter, more equipment-like.

---

## 5. Motion

Quiet, purposeful, focus-reinforcing. Timings live in tokens (`--dur-fast/base/slow`, `--ease-out/in-out`). **Everything collapses to nothing under `prefers-reduced-motion`** (a single global guard in `globals.css`).

| Animation | What | Where | Why |
|---|---|---|---|
| `cue-in` | 8px upward fade, 240ms | a new coach cue | draws the eye to the change without a jump |
| `phase-in` | subtle scale-in, 420ms | round ↔ rest switch | marks a real state change |
| `count-pulse` | one calm scale pulse/second | final-10 countdown | emphasis on the trust-critical moment — a heartbeat, not a strobe |
| `breathe` | slow 5.5s scale/opacity | rest timer, coach level | paces recovery breathing; signals "calm" |
| `rise` | 14px rise-in | screen/content entrance | confident, settled arrivals |

**Rules:**
- **No motion for motion's sake.** Every animation marks a *state change* or *emphasis* the athlete benefits from.
- **Never animate the timer digits' value** — only colour/scale of the container. The number itself is rock-steady.
- The countdown is a **single pulse per second**, deliberately not a fast flash (calm under pressure = the Corner personality).

---

## 6. Iconography

`lucide-react`, thin and consistent. Rules:
- **Sparingly** — icons support labels, rarely replace them. No icon that isn't instantly legible (Play, Pause, X, Settings, Library, History, Clock, Layers, Star, Flame, Chevron).
- Default `size-5`/`size-6`; always paired with a text label except the universally-understood transport controls.
- Muted by default (`text-muted-foreground`), brightening on hover/active.

---

## 7. Components (shared)

| Component | Role |
|---|---|
| `ui/button` (`buttonVariants`) | all buttons; **also applied to `Link`** for navigational CTAs (valid markup, no button-in-anchor) |
| `ui/BackLink` | consistent glove-friendly back affordance on secondary screens |
| `ui/card` | base raised surface primitive |
| `Workout/Countdown` | state + motion-aware timer (`work`/`rest`/`push`, breathing/pulsing) |
| `Workout/RoundNumber` | round position with dot-track (≤10) / bar (>10) |
| `Workout/CoachingCues` | current cue (large, animated) + quiet next preview |
| `Workout/CoachPresence` | honest "in your corner" live indicator |
| `Workout/Controls` | 64px pause/resume + set-apart quit |
| `Settings/SettingsControls` | `SettingGroup`, `SettingRow`, `Toggle`, `SegmentedChoice` |

---

## 8. States (loading · empty · error)

- **Loading:** skeletons that match the final layout (home hero, library grid), pulsing `bg-card` — never a bare "Loading…" string.
- **Empty:** an *invitation*, never a scolding blank — icon, one confident line, and a direct CTA (see History, Library empty states).
- **Error:** `destructive/10` panel with a `destructive/40` border; plain, honest copy; never a stack-trace or code.

---

## 9. Voice & microcopy

The interface talks like the coach (`../coaching/` and `../product/VOICE_GUIDELINES.md`), never like software.

| Instead of | Corner says |
|---|---|
| "Choose a workout to get started" | "Pick a session, press start, put the phone down." |
| "Workout Complete" | "Session complete — that was honest work. Well done." |
| "No completed workouts yet" | "Your first round starts it all." |
| "Speech Speed" | "Speaking speed · 1.0×" |

Rules: **fewer words**; concrete over generic; calm and confident; never hype, never robotic. Buttons are verbs ("Start workout", "Done", "Reset").

---

## 10. The system contract

> Dark, near-monochrome, quiet — colour means *phase*, red means *now*, motion marks *change*, and text always labels the meaning. One spacing scale, one radius family, soft elevation, tabular numbers, native type. Every screen uses the same primitives and the same voice, so Corner feels like a single premium instrument from the home screen to the final bell.
