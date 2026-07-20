# Product & Experience Specifications

> Corner's first phase is no longer implementation. **Discovery is.**

A **Product & Experience Specification** ("spec") is the discovery artifact written
*before* a feature is built. It answers *what should this feel like, for whom, and why* —
and gets reviewed — before any code is written. Implementation becomes the *last* phase, not
the first.

This directory is where specs live. It is a product-side sibling to the
[Architecture Decision Records](../architecture/) (`docs/architecture/`): ADRs record *how
the system is built*; specs record *what experience we intend to create*.

---

## The workflow

```
TODAY                          →   TOMORROW
Objective                          Objective
   ↓                                  ↓
Implementation                     Discovery
   ↓                                  ↓
PR                                 Product & Experience Specification   ← this directory
                                      ↓
                                   Review  (spec Accepted)
                                      ↓
                                   Implementation
                                      ↓
                                   PR  (links the spec; spec → Implemented)
```

When someone says *"I would like Workout History,"* the correct first response is **not**
"I'll implement Workout History." It is:

> "I'll begin with Product Discovery and write the Product & Experience Specification for
> review."

The full workflow lives in [CONTRIBUTING.md](../../CONTRIBUTING.md) → *How we work*. This
directory defines the spec **document type**.

---

## When a spec is required (proportionality)

Specs are mandatory for **experience-changing work** — anything the athlete sees, hears, or
feels, or any new capability. They are **not** required for changes that alter no experience.
This mirrors how ADRs are required only for boundary/contract changes, not every edit.

| Change | Spec required? |
|---|---|
| A new feature / screen / interaction (Workout History, a new coach behaviour) | **Yes** |
| A change to how something *feels* (copy, timing, a bell, presence) | **Yes** |
| A bug fix that restores intended behaviour | No — but say what the intended experience was |
| Pure investigation (INV-\*), refactor, docs, tooling, tests | No — those have their own doc types (investigation notes, ADRs) |
| Trivial/local change | No |

If unsure, write the spec. A spec that shows the work is *not* worth doing is a success —
Corner ships by removing as often as adding.

---

## What a spec is (and isn't)

A spec is **product + experience discovery**, not a design or engineering document.

- It **is**: the problem and who it's for; how the moment should *feel*; the happy path as a
  short narrative; an explicit check against Corner's non-negotiables; non-goals; the options
  considered and the recommended shape; open questions; success criteria.
- It **is not**: an implementation plan, file list, API, or architecture. *How* it's built is
  decided later (and, if it crosses a boundary, in an **ADR** referenced by the eventual PR).

Keep it short and honest. A spec is done when a reviewer can picture the experience and
agree it belongs in Corner — before a line of code exists.

Start from [`_TEMPLATE.md`](./_TEMPLATE.md).

---

## Naming & lifecycle

- **File name:** the feature slug — `docs/specifications/<feature-slug>.md`
  (e.g. `workout-history.md`, `begin-now.md`). We name by feature, **not** by PR number:
  the spec is written *before* the PR exists, so it can't know the number. The eventual PR
  links back to the spec, and the spec records the PR once merged.
- **Status** (in the spec header): `Draft → In Review → Accepted → Implemented → Superseded`.
  Only an **Accepted** spec should begin implementation. A spec that's later replaced is
  marked `Superseded` and points to its successor (never deleted — the memory stays honest,
  like the [Engineering Journey](../ENGINEERING_JOURNEY.md)).
- **One concern per spec**, like one concern per PR.

---

## The four questions (recommendations)

**1. Where does this philosophy belong — governance / contributing / development guides /
elsewhere?**
The **workflow** belongs in `CONTRIBUTING.md` (the canonical "How we work"), which already
said *"Design before implementation… several of our best PRs shipped only documents."* This
extends that. The **spec document type** belongs here in `docs/specifications/`, beside ADRs.
**Recommendation: do not add a new `docs/governance/` directory** — CONTRIBUTING is already
the governance home, and a second location would fragment it.

**2. Can Product Specifications become a mandatory phase before every PR?**
Before every **experience-changing** PR — yes (see the proportionality table). "Before every
PR" without qualification would tax trivial fixes and non-experience work; scoping it to
feature/experience PRs keeps the gate meaningful, matching the existing ADR rule.

**3. Can existing contribution guides be simplified?**
Yes. The old *"open an issue describing the approach"* + *"design before implementation"* are
subsumed by one clear first phase: **write the spec.** The spec *is* the agreed direction, so
CONTRIBUTING's proposal flow gets shorter, not longer (see the CONTRIBUTING update in this
change).

**4. Should feature branches begin with discovery rather than implementation?**
Yes. A feature branch's **first commit is its spec**, reviewable before code.
- *Larger/uncertain* work: a **spec-only PR** merged first, then a follow-up implementation PR.
- *Smaller* work: the spec is the first commit on the same branch; implementation follows in
  the same PR, but the spec was written and reviewable before the code.

**Can specs become a reusable document type?** Yes — that is exactly what this directory and
[`_TEMPLATE.md`](./_TEMPLATE.md) establish.

---

## Relationship to the other doc types

| Doc type | Answers | Lives in |
|---|---|---|
| **Product & Experience Spec** | *What should this feel like, for whom, why?* (before build) | `docs/specifications/` |
| **ADR** | *How is the system built / what did we decide structurally?* | `docs/architecture/` |
| **Investigation (INV-\*)** | *What actually happened / where did it break?* (evidence) | `docs/**` (near the subsystem) |

A single feature may produce a spec (first), then an ADR (if it touches a boundary), then the
implementation PR that links both.
