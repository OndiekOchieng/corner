# Design docs

Design, philosophy, and investigation notes for Corner. Start here.

## The coaching-presence arc

The core philosophy — *put the phone down, forget the phone exists, give the athlete
room to arrive, hear the bell, trust their coach, and box* — was worked out across a
sequence of investigations and small, mostly-subtractive changes:

1. [BELL_PHILOSOPHY.md](./BELL_PHILOSOPHY.md) — what the Bell *is*: the coach's silent
   peer, the voice of time's structure. It owns transitions, not products; one universal
   bell, no personalities.
2. [PRESENCE_AND_TRANSITIONS.md](./PRESENCE_AND_TRANSITIONS.md) — PR-030. Less software,
   more gym: the coach stops counting ("10… 5…" is a software-ism) and the bell announces
   round one instead of the coach.
3. [PREPARATION_AND_THE_BELL.md](./PREPARATION_AND_THE_BELL.md) — investigation: is
   *Preparation* a first-class phase? Owned at the start-sequence edge (Presence), not the
   Engine; and a struck-bell timbre beats a beep.
4. [OPENING_BELL_AND_GRACE.md](./OPENING_BELL_AND_GRACE.md) — PR-031. A 15 s grace period
   before boxing (Engine unaware) and one real `boxing-bell.mp3` with strike-count
   semantics (begin = 1, finish = ding-ding-ding).

Related speech-pipeline investigations live under
[`../media-runtime/`](../media-runtime/) — e.g.
[WHERE_IS_SPEECH_DYING.md](../media-runtime/WHERE_IS_SPEECH_DYING.md) and
[SESSION_INTRO_DOUBLE_PRODUCE.md](../media-runtime/SESSION_INTRO_DOUBLE_PRODUCE.md).

## Design system & reviews

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — tokens, components, visual language.
- [NAVIGATION.md](./NAVIGATION.md) — hub-and-spoke navigation model.
- [BEFORE_AFTER.md](./BEFORE_AFTER.md) — visual before/after references.
- [UX_REVIEW.md](./UX_REVIEW.md) · [ACCESSIBILITY_REVIEW.md](./ACCESSIBILITY_REVIEW.md) ·
  [RISKS.md](./RISKS.md) — reviews and risk register.

## Principles (the through-line)

- The Engine owns time. The Bell owns transitions. The Coach owns behaviour. Silence
  owns presence. The Athlete owns the experience.
- Corner coaches behaviour, not information.
- The coach speaks only when silence would coach less effectively; the bell rings only
  when silence would mark the transition less effectively.
- Software counts. A gym rings.
- Success is measured by better boxing, not more features.
