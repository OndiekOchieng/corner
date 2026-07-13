# Beta Readiness

Where Corner stands on the path from Internal Alpha to a first real athlete on a
real bag. This is the honest checklist: what is done and trustworthy, and what still
stands between here and Beta.

**Status:** Internal Alpha — the full platform runs a real, coached workout locally,
end to end. 237 tests passing, `tsc` clean, production build green.

Related: [ROADMAP.md](../ROADMAP.md) · [BETA_TEST_PLAN.md](product/BETA_TEST_PLAN.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md)

---

## ✅ Completed

| Area | State |
|---|---|
| **Engine** | Pure Execution Engine: Timeline, state machine, deterministic event stream. Exhaustively unit-tested. |
| **Runtime** | Host Runtime (RAF loop + time reconciliation) and Event Runtime (priority event bus) wired end-to-end. |
| **Sessions** | First-class `WorkoutSession` — identity, lifecycle, checkpointing, resume without re-speaking the past. |
| **Persistence** | `SessionRepository` over a single `localStorage` adapter, versioned envelope (v3) with migrations. |
| **Coaching** | Coach Runtime operational: Director → Silence → Planner → Queue → Sink. Judgement over narration, six coach packs, time anchors + reinforcement. |
| **Speech** | Speech pipeline verified end-to-end; the StrictMode disposal defect that silenced the coach is identified and fixed. Speech is heard. |
| **Media** | Media Runtime owns Speech, bells, Wake Lock, capability detection, visibility, and graceful degradation. |
| **UI** | Mobile-first workout screen: glove-friendly controls, dominant timer, pause/resume, HUD spacing, safe-area handling. |
| **History** | Completed sessions recorded and shown (workout, coach, duration, rounds, date, rating); cancel does not enter History. |

## ⏳ Remaining before Beta

| Area | What's needed | Why it matters |
|---|---|---|
| **Real device testing** | Structured passes on the phones and browsers athletes actually use (iOS Safari, Chrome Android), on a real bag. | Trust is proven in the wild, not in a simulator. The dev-only speech fix needs on-device confirmation of the production path. |
| **Lock screen behaviour** | Verify (and where possible improve) audio continuity when the screen locks or the tab backgrounds; document the true limits. | Athletes will pocket the phone. See [ADR-0003 — background tick source](architecture/DECISIONS.md) (open). |
| **Offline support** | Service worker / installable PWA so a workout runs with no connection at the bag. | Gyms and garages have bad signal; the coach must not need the network. |
| **Coach packs expansion** | More recognisable coaches; more rotating variants per line so no coach ever loops. | Breadth and freshness keep the voice human over repeated sessions. |
| **Workout catalogue** | Grow beyond the Foundations pack across levels, stances, and objectives. | A coach needs enough to teach for weeks, not one session. |
| **Analytics** | Minimal, privacy-respecting instrumentation of real usage (completion, drop-off, trust signals). | We can only fix what breaks the promise if we can see it. |
| **App Store / Play Store preparation** | Packaging, store listings, icons, permissions, and review readiness. | The devices people have are phones; meet them there. |

---

## Definition of "Beta ready"

A first invited athlete can, on their own phone and their own bag:
press Start, pocket the phone, complete a full workout hearing correct timing and
coaching throughout, and see the session in History afterward — with no moment that
breaks trust. Everything in **Remaining** exists to make that true on real devices.
