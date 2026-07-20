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

Discovery produces a **recommendation** before anything is specified or built.

```
Feature request
     ↓
Discovery
     ↓
Recommendation ──── NO ──────▶ DONE  (recorded; a success)
     │        └──── NOT YET ──▶ DONE  (recorded; a success)
     ↓
    YES
     ↓
Product & Experience Specification   ← this directory
     ↓
Review  (Accepted)
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

## Discovery is Corner's first *successful* phase

Discovery ends in one of three outcomes — **and all three are successes:**

- **YES** → the work is worth doing; write the specification, then implement.
- **NO** → the work isn't worth doing; record why, and stop. **Success.**
- **NOT YET** → right idea, wrong time; record what would change it, and stop. **Success.**

A specification that proves the work is *not* worth doing is a success. A recommendation of
**NO** is a success. A recommendation of **NOT YET** is a success. **Implementation is
therefore not the measure of successful product discovery** — a good decision is.

> Corner should never implement work simply because it was requested. Work should first be
> **discovered**, then **recommended**, then **specified**, and finally **implemented when
> appropriate**.

A NO or NOT YET is still recorded here (a short spec whose Recommendation is NO/NOT YET,
Status `Declined`/`Deferred`) — so the decision, and the thinking behind it, is remembered
and never re-litigated from scratch.

---

## When discovery is required (proportionality)

Discovery is mandatory for **product-changing or architecturally meaningful work** —
anything that introduces or changes a product experience, or that introduces or changes
ownership between the layers. The intention **isn't to slow Corner down; it's to slow down
important decisions.** This mirrors how ADRs are required only for boundary/contract changes,
not every edit.

**Discovery required:**
- BEGIN NOW · Workout History · Flight Recorder · Coach Personalities · Your Session
- Bell Philosophy changes
- anything introducing or changing **ownership** or **product experiences**

**No discovery required:**
- typo fixes · small styling fixes · bell *volume* tweaks
- trivial refactors · investigations (INV-\*) · documentation-only changes · small bug fixes

| Change | Discovery? |
|---|---|
| New product experience / capability (Workout History, Coach Personalities) | **Yes** |
| A change to *ownership* between layers, or to a product philosophy (Bell Philosophy) | **Yes** |
| A change to how something *feels* at the product level (a new presence, a transition) | **Yes** |
| A small styling / volume / copy tweak that doesn't change the experience | No |
| Bug fix restoring intended behaviour | No — but say what the intended experience was |
| Investigation (INV-\*), refactor, docs, tooling, tests | No — those have their own doc types |

If unsure, do the discovery. It's cheap; a wrong build isn't.

---

## What a spec is (and isn't)

A spec is **product + experience discovery**, not a design or engineering document.

- It **is**: the problem and who it's for; a **recommendation** (YES / NO / NOT YET) with its
  reasoning; and — when YES — how the moment should *feel*, the happy path as a short
  narrative, an explicit check against Corner's non-negotiables, non-goals, the options
  considered and the recommended shape, open questions, and success criteria.
- It **is not**: an implementation plan, file list, API, or architecture. *How* it's built is
  decided later (and, if it crosses a boundary, in an **ADR** referenced by the eventual PR).

A NO / NOT YET spec can be **short** — the recommendation and its reasoning are enough; the
detailed experience sections are only filled in on a YES. Keep it honest. A spec is done when
a reviewer can either agree the work shouldn't happen (yet), or picture the experience and
agree it belongs in Corner — before a line of code exists.

Start from [`_TEMPLATE.md`](./_TEMPLATE.md).

---

## Naming & lifecycle

- **File name:** the feature slug — `docs/specifications/<feature-slug>.md`
  (e.g. `workout-history.md`, `begin-now.md`). We name by feature, **not** by PR number:
  the spec is written *before* the PR exists, so it can't know the number. The eventual PR
  links back to the spec, and the spec records the PR once merged.
- **Status** (in the spec header): `Draft → In Review →` then one of
  `Accepted` · `Declined` (NO) · `Deferred` (NOT YET) `→ Implemented → Superseded`.
  Only an **Accepted** spec begins implementation; `Declined` and `Deferred` are **complete,
  successful** outcomes and stay recorded (never deleted — the memory stays honest, like the
  [Engineering Journey](../ENGINEERING_JOURNEY.md)). A replaced spec is `Superseded` and points
  to its successor.
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
Before every **product-changing or architecturally meaningful** PR — yes (see the
proportionality section). "Before every PR" without qualification would tax typo fixes,
styling/volume tweaks, and non-product work; scoping it to product/ownership changes keeps
the gate meaningful, matching the existing ADR rule. **Discovery slows down important
decisions, not Corner.**

**3. Can existing contribution guides be simplified?**
Yes. The old *"open an issue describing the approach"* + *"design before implementation"* are
subsumed by one clear first phase: **discovery → recommendation → (on YES) spec.** The spec
*is* the agreed direction, so CONTRIBUTING's proposal flow gets shorter, not longer.

**4. Should feature branches begin with discovery rather than implementation?**
Yes. **Product-changing work SHOULD prefer specification-only PRs before implementation** —
the spec is reviewed and Accepted in its own PR, then a follow-up implementation PR references
it. `SHOULD` is intentional: there will naturally be exceptions (a small, certain change may
carry its spec as the first commit of the same branch). This protects what Corner has become
good at: **thoughtful discussions before thoughtful implementations.**

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
