# Philosophy Discovery — what should survive us (July refresh)

**Discovery only. No documents updated, no implementation, no ownership assumed.** The
deliverable is *understanding*, not documentation. This is a record of what a month of work
taught us about Corner — for a future engineer to decide where, if anywhere, it should be
written down.

> The question is not *"what documentation should we write?"* It is *"what have we learned
> about Corner that should survive us?"*

---

## Verdict

**YES — Corner's philosophy has materially evolved**, along one dominant axis and a few
supporting ones. The month's findings are already *recorded* (in the investigation and spec
docs); what has changed is the **philosophy distilled from them**, which currently lives
nowhere as a single, durable statement. So: the philosophy evolved (YES); the findings are
captured (YES); a distilled north-star is *missing* (the one gap) — but writing it is future
work, not this task.

There is also a small **"we were asking the wrong question"**: the prompt reframed *"what docs
to write"* into *"what have we learned that should survive"* — and that reframe is itself the
finding. The learning is **philosophy**, and documentation is merely its eventual shadow.

---

## 1. The dominant shift — the unit of truth moved

The single biggest evolution: **success and failure stopped being software states and became
athlete experiences.**

| Old unit of truth (software state) | New unit of truth (athlete experience) |
|---|---|
| 42/42 cues delivered | The athlete forgot their phone existed |
| Wake lock held | The Coach never stopped coaching |
| Speech uninterrupted | The athlete never had to intervene |
| Uninterrupted foreground state | Success / Partial / Failure are things the *athlete* felt |

This runs through everything: BEGIN NOW (presence over instant-start), PR-028 (behaviour over
information), PR-030 (a gym rings, software counts), and most sharply INV-003 → INV-004 (*the
Coach never stopped; the hearing did* → *the only failure is the athlete having to intervene*).
Corner now measures itself in the athlete's felt experience, not the machine's counters.

---

## 2. Classifying the discoveries (§2)

Not everything we said is philosophy. The taxonomy matters — it decides what is *load-bearing*
versus *derived*:

| Statement | Kind |
|---|---|
| **The Coach never stops coaching.** | **Philosophy** (a promise) — *and* a proven finding (INV-001) |
| **Forget the phone. Remember the boxing.** | **Philosophy** (the product's purpose) |
| **The athlete is the north star.** | **Philosophy** (the orienting principle) |
| Failure occurs only when the athlete must intervene. | **Success criterion / product principle** (how we measure) |
| Success, Partial, Failure are athlete experiences, not software states. | **Success criterion / principle** |
| Continuous Coaching is not Continuous Hearing. | **Investigation finding → principle** (a distinction we now hold) |
| The Coach never stopped; the hearing did. | **Investigation finding** (INV-003 — a memorable articulation of the above) |
| Discover → Recommend → Specify → Implement last. | **Method / governance principle** |
| Silence is coaching; behaviour over information; a gym rings. | **Coaching craft** (PR-028/030) |
| Wake lock is immersion protection; foreground is a proxy. | **Investigation finding** (INV-002/004) — an *input* to the athlete criterion |

The three **Philosophy** rows are the north stars. Everything below them is *how we honour
them*. The finding-level rows already live in their investigation docs; the philosophy-level
rows live nowhere durable — that's the gap.

---

## 3. Success criteria — evolved, and should survive (§3)

Yes, our definition of success has materially changed, and it **should survive in the repo** as
an explicit, athlete-centred definition:

- **Success** = a 30-minute workout the athlete finished having *forgotten the phone existed*;
  the Coach remained continuously audible; **they never had to intervene.**
- **Partial** = a momentary gap that *self-recovered* with no athlete action.
- **Failure** = the athlete was repeatedly forced to act (unlock / tap / refresh / reopen).

These are **athlete experiences, not software states** — the same event (a wake-lock release)
is a failure only if it forced the athlete to act. This definition currently exists scattered
across INV-003/INV-004; it deserves to be stated once, plainly.

---

## 4. The athlete review (§4) — true, with a methodological correction

**"The athlete is Corner's north star" — TRUE**, and it exposes a category error we've been
making:

1. **Should Athlete UAT differ from Developer investigations?** **Yes — they measure different
   things.** Developer investigations measure *software health* ("did speech reach the browser?
   did wake lock hold?" — the Developer Workout Story). Athlete UAT measures *experience* ("did
   I forget the phone? did I have to act?"). Two lenses, two verdicts.
2. **Have we been unfairly classifying developer interruptions as athlete failures?** **Yes.**
   The clearest case: the "speech is dying" alarm was a *developer sandbox artifact*
   (WHERE_IS_SPEECH_DYING), not an athlete failure. And a developer testing with the screen in
   hand experiences wake-lock/visibility differently from an athlete boxing to a pocketed phone.
   We repeatedly counted *machine events a developer observed* as *athlete failures*. They are
   not the same, and conflating them made problems look worse than the athlete's reality.
3. **Should athlete and developer experiences be evaluated differently?** **Yes** — and Corner
   already built the tools for both: the athlete lens (presence, immersion, non-intervention)
   and the developer lens (Flight Recorder, Developer Workout Stories). The remaining error is
   evaluative, not tooling: judge each by its own criterion.

---

## 5. Investigation philosophy — materially changed (§5)

Corner changed *how it investigates*, and this belongs in the record:

| Old | New |
|---|---|
| Fix things | Discover → Understand → Recommend → **Implement last** |
| "Speech is broken" | "Interesting… **NO IDEA yet**" (an honest, valid state) |
| Failures matter | **Successes are equally valuable** — NO / NOT YET / a spec that stops work are all wins |
| Build what was requested | **Never implement work simply because it was requested** |

This is largely *already* captured in `CONTRIBUTING.md` and `docs/specifications/README.md`
(discovery-first governance). What is *not* yet stated is the epistemic humility — **"NO IDEA
yet" is an honest, respectable answer** — and that a *no-code investigation is first-class
work*. Worth a sentence, someday.

---

## 6. What should survive us (§7)

If Corner were handed to another engineer tomorrow, these must survive — because a new engineer
reads *code*, and none of this is in the code:

**The north stars (philosophy):**
- **The Coach never stops coaching.**
- **Forget the phone. Remember the boxing.** / **Box first, engineer later.**
- **The athlete is the north star** — success/partial/failure are athlete experiences, not
  software states; failure is *only* when the athlete must intervene.

**The method:**
- **Discover first, engineer last.** YES / NO / NOT YET are all successful outcomes. Never build
  because asked.
- **Evidence over intuition. "NO IDEA yet" is honest.** Investigations are first-class work.
- **Boring architecture over clever; remove over add.**

**The craft:**
- **Silence is coaching. Behaviour over information. A gym rings; software counts.**
- **Corner remembers the workout** — the session leaves an honest story of itself.

---

## Document-ownership proposal (§6) — recommendation only, nothing assumed

Where each *naturally* belongs (a proposal for a future engineer to accept or reject — **not**
executed here):

| Discovery | Natural home (proposed) | Status today |
|---|---|---|
| The three north stars (philosophy) | a single distilled **Philosophy / North Star** doc — new, short, or folded into `docs/product/PRODUCT.md` | **missing** — scattered across INV docs |
| Athlete-centred **success definition** (Success/Partial/Failure) | the same Philosophy doc, *and* referenced by the spec template's Success-Criteria section | scattered (INV-003/004) |
| Discover→Recommend→Specify→Implement + "NO IDEA is honest" | `CONTRIBUTING.md` + `docs/specifications/README.md` | **mostly present**; add the epistemic-humility line |
| Athlete-lens vs Developer-lens distinction | the Philosophy doc (a paragraph) | **missing** — this is a genuinely new, unwritten insight |
| Continuous-Coaching / Athlete-Continuity findings | already in `COACH_CONTINUITY` / `CONTINUOUS_COACHING` / `ATHLETE_CONTINUITY` | **captured** — leave as-is |
| Bell / presence / coaching-craft philosophy | already in `docs/design/*` and `docs/coaching/*` | **captured** |

**The one real gap:** the *findings* are documented; the *distilled philosophy above them* is
not. A short, durable **North Star** document (the three philosophies + the athlete success
definition + the athlete-vs-developer lens) is the single most valuable future documentation —
because it is the part a code-reading successor would otherwise never find.

---

## Recommendations — future documentation work only (no execution)

1. **A short North Star / Philosophy doc** — the three north stars, the athlete-centred success
   definition, and the athlete-vs-developer lens. One page. The highest-value doc Corner
   doesn't have. *(Its own spec/discovery, later.)*
2. **One line in `CONTRIBUTING.md` / specifications README** — "NO IDEA yet" is an honest
   outcome; a no-code investigation is first-class work. *(Small.)*
3. **One line in the spec template** — success criteria are *athlete experiences, not software
   states* (reinforces §7's existing question).
4. **Leave the investigation docs as-is** — they are the honest record; do not rewrite them.

None of the above is done in this task. This discovery only *recommends* it.

---

## The final answer

> What have we learned about Corner that should survive us?

**Corner's philosophy has materially evolved (YES)** — its unit of truth moved from *software
states* to *athlete experiences*, and a *discovery-first, evidence-first* method solidified. The
three things that must survive us are: **the Coach never stops coaching · forget the phone,
remember the boxing · the athlete is the north star (success is what the athlete felt, and
failure is only when they had to intervene).**

The findings are already written; the **distilled philosophy above them is not** — and that,
not more documentation, is what a future engineer would miss. Writing it is the next work, not
this one.

**No documents were changed. The deliverable is understanding.**
