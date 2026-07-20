<!--
Product & Experience Specification — TEMPLATE.
Copy to docs/specifications/<feature-slug>.md and fill in. Delete these comments and any
sections that genuinely don't apply. Keep it short and honest: a reviewer should be able to
picture the experience and agree it belongs in Corner *before* any code exists.
This is product + experience discovery — NOT a design/implementation plan.
-->

# Spec — <Feature name>

| | |
|---|---|
| **Status** | Draft · In Review · Accepted · Implemented · Superseded |
| **Author** | <name> |
| **Date** | <YYYY-MM-DD> |
| **PR** | <#-, filled once opened> |
| **Related** | <ADRs, investigations, other specs> |

## The ask

> "<One line, in the requester's words — e.g. *I would like Workout History.*>"

## Problem — why now

What's missing, and why it matters *today*. Ground it in evidence where possible (UAT
feedback, a user journey, an investigation) rather than assertion. What does the athlete
currently feel that they shouldn't — or not feel that they should?

## Who it's for

The athlete (or developer) and the **moment** this serves — where they are, what they're
doing, what they need in that instant.

## The experience

The heart of the spec. Describe how it should **feel**, as a short narrative of the happy
path — what the person does, hears, and feels, start to finish. Prose or a small flow, not
UI specs. If it makes a sound or breaks a silence, say why that's right.

```
<optional: the moment, as a small flow>
```

## Philosophy alignment

How this honours Corner's non-negotiables — and where it risks violating them. Be explicit;
this is the gate, not a formality.

- **Put the phone down / forget the phone exists** — does this pull attention to the device?
- **Behaviour over information; silence over unnecessary speech** — does it add words/sounds,
  or remove them? (Corner ships by removing as often as adding.)
- **Trust is the product** — is it honest? Does it ever claim to see the athlete, shame, or
  break character?
- **Ownership** — Engine owns time · Bell owns transitions · Coach owns behaviour · Silence
  owns presence · the Athlete owns the experience. Whose concern is this, and does it respect
  the boundaries?

## Non-goals

What this is explicitly **not** — the scope creep we're refusing. (A strong non-goals list is
one of the most Corner things a spec can have.)

## Options considered

The alternatives and their trade-offs — including *do nothing*. Discovery means more than one
path was weighed.

| Option | Pros | Cons |
|---|---|---|
| … | … | … |

## Recommendation

The chosen **shape** of the experience (still product-level, not code). Why it wins against
the alternatives.

## Open questions

What must be decided before or during implementation. Flag anything that needs a person's
call rather than a default.

## Success criteria

How we'll know it worked — in terms of what the athlete **feels/does**, not vanity metrics.
Finish with the one question every Corner change must pass:

> Does this help the athlete forget they are training with software?

## Implementation notes (light)

Only enough to hand off — which layer owns it, boundaries respected, determinism preserved.
**Not** a design doc: if it crosses an architectural boundary or a contract, that decision
belongs in an **ADR** (`docs/architecture/`) referenced from the eventual PR.
