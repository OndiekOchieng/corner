# WORKOUT_SCHEMA.md — The Product Schema for a Workout

This defines the **authoring vocabulary** — the fields a coach fills in to describe a workout, and the rules those fields must follow. It is a **product schema**, not the engine's implementation schema: it is written for coaches and editors, in coaching terms. (An engineer maps it to the runtime's `WorkoutConfig` separately; that mapping is out of scope here.)

Notation below is illustrative structure, not code. Timing is expressed the way coaches think — in **phases** and **seconds within a round** — not milliseconds.

---

## 1. Entities

```
Workout
 ├─ metadata (name, id, objective, difficulty, stance, tags, author, version, coachPacks)
 ├─ warmup    (a special low-intensity Round)
 ├─ rounds[]  (ordered; each a Round)
 └─ cooldown  (a special low-intensity Round)

Round
 ├─ focus (one objective for this round)
 ├─ archetype (from ROUND_LIBRARY)
 ├─ drill (the punch/combination/skill worked)
 ├─ durationSeconds, restSeconds
 └─ cues[]   (ordered coaching lines, each with placement)

Cue
 ├─ text (the spoken line)
 ├─ category (from CUE_LIBRARY)
 ├─ placement (phase or second within the round)
 └─ priority (structure > coaching > optional)
```

---

## 2. Workout fields

| Field | Type | Required | Meaning / rule |
|---|---|---|---|
| `name` | text | ✓ | The promise. Title Case, evocative, boxing-true. See §7. |
| `id` | slug | ✓ | Stable identifier, kebab-case (e.g. `orthodox-power`). Never reused/changed. |
| `objective` | one sentence | ✓ | The **one** thing the athlete leaves better at. |
| `difficulty` | `beginner \| intermediate \| advanced` | ✓ | See `PROGRESSION_MODEL.md`. |
| `stance` | `orthodox \| southpaw \| both` | ✓ | Who it's coached for. Southpaw workouts use southpaw cueing. |
| `type` | see §5 | ✓ | Technical / combinations / defense / conditioning / fight-sim / recovery. |
| `tags` | list | ✓ | From the controlled tag vocabulary (§5). |
| `durationEstimate` | minutes | ✓ | Derived from rounds + rest; shown to the athlete pre-flight. |
| `warmup` | Round | ✓ | Prepares this session's specific work. |
| `rounds` | ordered list | ✓ | ≥1; each with one focus; they relate. |
| `cooldown` | Round | ✓ | Reinforces objective; closes. |
| `coachPacks` | list | ✓ | Recommended packs (§`../product/COACH_PACKS.md`), in preference order. |
| `author` | Author | ✓ | See §8. |
| `version` | semver-lite | ✓ | See §9. |
| `prerequisites` | list of workout ids | – | Skills/workouts assumed first. |
| `progressionNext` | list of workout ids | – | Suggested next step(s). |
| `notes` | text | – | Author intent / coaching context for editors. |

---

## 3. Round fields

| Field | Required | Rule |
|---|---|---|
| `focus` | ✓ | One sentence — the single thing this round is about. |
| `archetype` | ✓ | From `ROUND_LIBRARY.md` (e.g. `double-jab`, `defence`, `fight-pace`). |
| `drill` | ✓ | The punch/combination/skill (e.g. "jab, cross," "slip and counter"). |
| `durationSeconds` | ✓ | Typically 120 (beginner) / 180 (standard). See archetype defaults. |
| `restSeconds` | ✓ | Typically 60; tighter for advanced/conditioning. Last round needs no rest. |
| `intensity` | ✓ | `low \| moderate \| high` — guides the coach's energy. |
| `cues` | ✓ | Ordered coaching lines (§4). |

Warmup/cooldown are Rounds with `intensity: low` and a preparing/closing focus.

---

## 4. Cue fields & placement

A cue is a spoken line with a *placement intent*, not a hard timestamp — coaches author in phases; the runtime resolves exact timing.

| Field | Rule |
|---|---|
| `text` | The spoken line. Obeys `../product/VOICE_GUIDELINES.md` (short, one idea, boxing-specific). |
| `category` | From `CUE_LIBRARY.md` (Technique, Movement, Guard, Breathing, Power, Rhythm, Distance, Recovery, Mindset, Urgency, Ring IQ). |
| `placement` | One of: `round-start`, `early`, `mid`, `late`, `final-30`, `countdown`, `rest`, or an explicit second offset. |
| `priority` | `structure` (round call, combination, countdown) > `coaching` (technique/pace) > `optional` (encouragement). Lower priority is dropped on timing conflict. |

**Placement rules:** structure cues occupy fixed moments; coaching cues are spaced (baseline one per 20–40s of work); teaching (longer lines) is `rest`-only.

---

## 5. Type & tag vocabulary (controlled)

- **`type`** (exactly one): `technical` · `combinations` · `defense` · `conditioning` · `fight-simulation` · `recovery`.
- **`tags`** (from a controlled list — keep it disciplined, don't invent freely):
  - *Skill:* `jab`, `cross`, `hook`, `uppercut`, `body`, `slip`, `roll`, `counter`, `footwork`, `angles`, `guard`.
  - *Quality:* `power`, `speed`, `endurance`, `rhythm`, `pressure`, `distance`.
  - *Context:* `beginner-friendly`, `southpaw`, `orthodox`, `short-session`, `active-recovery`, `fight-pace`.

New tags require editorial approval — an uncontrolled tag list makes the catalog unsearchable and inconsistent.

---

## 6. Relationships

- **`prerequisites`** — workouts/skills the athlete should have done first (e.g. Slip & Counter requires Establish the Jab).
- **`progressionNext`** — the natural next step(s), powering "what to train next" recommendations.
- **`packMembership`** — which official pack(s) a workout belongs to (e.g. *Foundations*).
- **`variantOf`** — if a workout is a stance/difficulty variant of another (e.g. a southpaw mirror), it references the original.

Relationships are how the catalog becomes a **curriculum**, not a pile of sessions.

---

## 7. Naming conventions

- **Names:** Title Case, evocative, and honest about the work. Good: "Orthodox Power," "Slip & Counter," "Fight Conditioning." Bad: "Workout 3," "HIIT Boxing," "Session A."
- **IDs:** kebab-case, stable forever (e.g. `slip-and-counter`). The name may be refined; the id never changes.
- **Rounds:** referenced by focus, not numbers, in prose ("the body-work round"). The athlete hears "Round three," but authors think in focus.

---

## 8. Author information

Every workout records its author for accountability and voice consistency:

```
author:
  name: "Coach <name>"
  credentials: "e.g. amateur record / years coaching / certifications"
  contact: internal handle
```

The author is responsible for the workout meeting this standard and for revisions. Attribution also lets athletes follow coaches they like.

---

## 9. Versioning

Workouts evolve; changes must be traceable.

- **`version: MAJOR.MINOR`**
  - **MINOR** — wording/cue tweaks that don't change the training (e.g. sharpen a cue). Safe to auto-update.
  - **MAJOR** — structural change (rounds added/removed, objective/difficulty changed). Effectively a new training experience; may warrant a new id/variant.
- **Changelog** — every version records what changed and why, so editors and athletes understand the difference.
- **Stability contract:** a published id's *identity* (name, objective, difficulty) shouldn't silently shift under athletes. Big changes ship as variants, not surprises.

---

## 10. Validation rules (editorial, enforced at review)

A workout is invalid if any of these fail:

1. Missing a required field (§2), especially **`objective`**.
2. Missing **warmup** or **cooldown**.
3. A round without a single clear **focus**, or rounds that don't relate/build.
4. **Cue density** out of bounds — dead air (too few) or a firehose (too many); see `CUE_LIBRARY.md`.
5. **Contradictory coaching** — two cues that fight (e.g. "stay long" then "get inside" with no transition).
6. Teaching (long lines) placed anywhere but **rest**.
7. A cue that **claims to see** the athlete, is **unsafe**, or could be **mistimed**.
8. **Difficulty mismatch** — content/tone doesn't match the declared level.
9. Uncontrolled **tags** or `type`.
10. No recommended **coach pack**, or a pack that clashes with the workout's character.

Passing validation is necessary but not sufficient — the workout must also pass `QUALITY_CHECKLIST.md` (the felt-quality review).
