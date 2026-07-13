# ARCHITECTURE_REVIEW.md — Principal Review of ADR-0001 (Workout Engine)

- **Reviewer role:** Principal Engineer, pre-approval architecture review
- **Under review:** `ADR-0001-workout-engine.md`, `ENGINE.md`, `STATE_MACHINE.md`, `EVENT_MODEL.md`, `IMPLEMENTATION_PLAN.md`
- **Horizon:** must survive ~5 years of evolution (Coach Packs, Custom Workouts, Builder, Cloud Sync, Apple Watch, Wear OS, Heart Rate, Punch Counting, AI Coach, Sharing)
- **Mandate:** find hidden coupling, scalability limits, ambiguous ownership, testing blind spots, and better alternatives. Recommend only changes that *materially* improve the architecture.

---

## 0. Verdict

**Changes requested — conditional approval.**

The proposal is a large step up from the status quo: derived time, a pure inspectable Timeline, exactly-once events, and a subscriber seam are all the right instincts, and the transition-table discipline is solid. **For the workout Corner ships *today* (fixed-duration boxing rounds), this design is sound and I would approve it.**

However, the ADR's own success criterion is *"a foundation that supports future features without another rewrite."* Judged against **that** bar and the stated 5-year feature set, the design has **four load-bearing assumptions that the future features directly violate**, and each is far cheaper to resolve in the model now than to retrofit later. They are the "Must Fix" items. Approve to implement the *fixed-workout* core (PR-003) **only after** the ADR either absorbs these decisions or explicitly scopes them out with an accepted-debt rationale — because two of them (the tick source and the adaptivity model) shape the core data types, and changing those types *is* the rewrite this PR exists to avoid.

The single highest-leverage question: **is deterministic replay of a fixed timeline the right center of gravity, when the product's differentiator (adaptive, sensor-aware AI coaching) is fundamentally *not* a fixed timeline?** Everything below orbits that question.

---

## 1. Must Fix (block approval until resolved or explicitly deferred with rationale)

### M1 — The immutable absolute-offset Timeline cannot express the adaptive workouts the roadmap requires
**Finding.** `ENGINE.md` §3 makes the Timeline a precompiled array of segments with **absolute `startMs`/`endMs`** and markers at **`endMs − 10s`**, etc. This is elegant *only while every segment's duration is known in advance.* The 5-year matrix explicitly includes Heart Rate, Punch Counting, and AI Coach — which imply segments like *"rest until HR < 120,"* *"AMRAP round until the user taps,"* *"extend this round until 100 punches,"* or AI shortening a round live. None of these have a knowable `endMs`, so:
- countdown markers (`endMs − 10s`) are **undefined** for open-ended segments;
- the "pure lookup `stateAt(elapsedMs)`" guarantee collapses when the boundary is a predicate, not a time;
- `recompileFrom` (EVENT_MODEL §7) is quietly load-bearing but under-specified — what happens to already-crossed markers, paused-time accounting, and events emitted before the recompile?

**Why it matters (5-yr).** The differentiator between "Corner" and a $2 interval timer *is* adaptivity. Baking "duration is a known constant" into the core type is baking the timer assumption back in one layer up. Retrofitting predicate-terminated segments into a flat absolute-offset array is a core-type change — i.e., the rewrite this ADR is meant to prevent.

**Recommendation.** Decide the core model *now*:
- Model a segment's end as a **`Terminator` union**: `{ kind: 'duration', ms } | { kind: 'predicate', id } | { kind: 'openEnded' }`. Absolute offsets become a *derived projection* valid only for the `duration` prefix; beyond the first non-duration segment the Timeline is computed **lazily from the cursor**.
- Redefine countdown/cue markers as **relative to segment boundaries** (`fromEnd: 10s`) so they're meaningful once (and only once) an end becomes known — with a rule that a predicate segment simply has no end-relative countdown.
- Promote `recompileFrom` from a footnote to a first-class, fully specified operation with its own invariants and tests, or explicitly declare adaptivity out of scope for the engine and push it entirely to authoring (and accept that AI/HR features will re-open the core).

### M2 — `requestAnimationFrame` is the wrong tick source for hands-free, screen-off coaching (the core use case)
**Finding.** `ENGINE.md` §4 drives ticking from a `requestAnimationFrame` loop and mitigates backgrounding with fast-forward on `visibilitychange`. But rAF is **suspended while the tab is backgrounded and while the screen is off**. Fast-forward only helps *when the user returns*. During the workout with the phone face-down and screen asleep — the literal "throw the phone on the floor" scenario in the ADR's own context — **no tick fires, so no `ROUND_STARTED`/`COACH_CUE`/`COUNTDOWN` event fires, so the coach is silent.** The design then leans on Wake Lock for timeliness while simultaneously declaring Wake Lock "progressive enhancement, not a correctness dependency" (§6). On devices without Wake Lock (notably older iOS Safari — a large share of a phone-first fitness audience), the primary product experience silently degrades to *no coaching audio*, and `drop-if-stale` (below) guarantees the missed cues are never spoken on wake.

**Why it matters (5-yr).** This is a direct contradiction between the product thesis and the chosen primitive, in the most common real-world condition. It is not a corner case; it is the case.

**Recommendation.** Separate **tick source** from **render source** in the ADR (it currently conflates them by only comparing "counter vs derived time," never "what advances the clock"):
- Use a **background-capable scheduler** for coaching/time: a **Web Worker `setInterval`** (workers keep running when backgrounded, albeit throttled) and/or an **AudioContext-based clock** (an active audio graph keeps a page alive and scheduling on many platforms — and Corner already owns an `AudioContext` for bells). Schedule the *audio* of upcoming cues on the audio clock so they fire even if the main thread is throttled.
- Keep rAF strictly for the visual timer/progress ring.
- Re-frame Wake Lock as *one* timeliness mechanism among several, and define the real fallback (audio-session keep-alive), rather than "correctness holds on wake" — because "correct but silent for 3 minutes" is a product failure even if the state is right.

### M3 — The persistence/transport model contradicts the wearable, sync, and recovery promises
**Finding.** `EVENT_MODEL.md` §4 fixes delivery as **synchronous, in-process, exactly-once, with no replay for late subscribers** and states *"at-least-once is not offered and not needed."* Yet the future-compat matrix promises Apple Watch / Wear OS subscribers *"over a transport,"* Cloud Sync, and Sharing — **all of which cross a process or network boundary** and therefore require async delivery, ordering across the wire, reconnection, backpressure, and **replay/redelivery**. A remote subscriber that connects mid-workout or drops a connection is, by the current spec, unrecoverable. Separately, there is **no schema versioning** on `WorkoutConfig` / `SessionSnapshot` / shared-workout payloads — mandatory the moment data is persisted or synced across app versions and devices.

**Why it matters (5-yr).** "No engine change for wearables/sync" is asserted but not supported by the event model; the model actively precludes it. And unversioned persisted/synced schemas are the classic source of the *next* forced migration.

**Recommendation.**
- Introduce an **append-only event log** as the canonical record (see Alt-A) or, at minimum, make the bus a thin projection over a retained, ordered event log so a transport adapter can offer **at-least-once with replay-from-seq**. Keep in-process subscribers synchronous; make *remote* delivery an explicit async adapter with its own guarantees.
- Add a mandatory **`schemaVersion`** to every persisted/transported type and a documented migration policy (forward-compatible readers, versioned writers). Cheap now; catastrophic later.

### M4 — Session durability and crash/abandon recovery are unowned
**Finding.** `ENGINE.md` §7 persists a `SessionSnapshot` on `WORKOUT_COMPLETED`. But a user who closes the tab, gets a call, or crashes mid-round emits **no** `WORKOUT_COMPLETED` → **no session is persisted** and there is **no resume**. Ownership of "in-flight session durability" and "resume an interrupted workout" is assigned to no component. The "History store" is referenced as an owner throughout but never specified (write path, transactionality, reconciliation with cancelled sessions).

**Why it matters (5-yr).** Abandoned/interrupted workouts are common on mobile. Lost history erodes trust and breaks streaks/analytics; no-resume is a visible product gap. Sync amplifies it (partial sessions across devices).

**Recommendation.** Specify the **History/Session store** as a real component with: periodic durable checkpointing of the in-flight `SessionSnapshot` (e.g., on each lifecycle event), a `status: 'abandoned'` reconciliation on next launch, and an explicit **resume** path (rehydrate engine at a cursor). Decide its ownership relative to the engine (recommend: a `StatsSubscriber` + repository, engine stays pure) and write it into the ADR.

---

## 2. Should Fix (material, but can land within the engine track without reshaping core types)

### S1 — `drop-if-stale` conflates countdown (safe to drop) with coaching cues (content loss)
`EVENT_MODEL.md` §2 applies one `drop-if-stale` policy to both countdown seconds and `COACH_CUE`. Dropping a stale "five, four, three" is correct; silently dropping a *technique/safety cue* on any hiccup is content loss, and (per M2) will happen routinely on screen-off devices. **Recommend** per-marker policies: countdown = drop; cues = *deliver-latest-relevant* (collapse missed cues to the most recent still-valid one for the current segment) rather than drop-all. Tune the `STALE_THRESHOLD_MS` per policy.

### S2 — The highest-risk component (host loop / visibility / wake lock) is explicitly excluded from real testing
`IMPLEMENTATION_PLAN.md` §3.3 says the core is tested with a FakeClock and real-timer behaviour is checked only by "a lightweight integration check." But the audit's worst bug (P0-3) *was* a host/timing bug. The seam most likely to fail in the field is the least tested. **Recommend** a real integration/e2e suite (Playwright) that emulates `visibilitychange`, background throttling (CDP), Wake Lock loss, and tab suspension — treated as a first-class deliverable of PR-004/PR-005, not an afterthought.

### S3 — Synchronous, in-process delivery couples subscriber latency and reentrancy into engine timing
`EVENT_MODEL.md` §4 delivers events synchronously within the emitting `tick()`. A slow subscriber (e.g., a Stats write, an analytics call) therefore **blocks the tick and delays subsequent events/state updates** — reintroducing timing nondeterminism through the back door. Reentrancy (a subscriber issuing a command mid-dispatch) is prevented only "by convention" (§5 rule 1). **Recommend**: (a) bound synchronous subscribers to pure, fast work and move I/O subscribers (Stats persistence, Analytics, remote) behind a queued async boundary; (b) prevent reentrancy **by construction** (dispatch a command issued during delivery onto the next tick, or reject it), not by documentation.

### S4 — Eager content resolution in event payloads couples the engine to content and i18n
`ENGINE.md` §3 pre-resolves cue *text* into markers/events "so subscribers carry no lookup logic." This directly contradicts the guiding principle that the engine knows nothing about presentation: localized strings, Coach-Pack assets, and remote content are presentation/content concerns. Baking resolved English text into the event stream will force a change when i18n or Coach Packs arrive. **Recommend** events carry stable **content IDs + parameters**; a `ContentResolver` (or the Coach subscriber) resolves to localized text/assets. Keeps the engine content-agnostic.

### S5 — The single per-frame snapshot fights the "coalesce to 1 Hz" intent
`EVENT_MODEL.md` §1 puts both `remainingMs` (per-frame) and `remainingSeconds` (1 Hz) in **one** snapshot object. If the object identity changes every frame, `useSyncExternalStore` re-renders every frame regardless of intent (perf regression R8 becomes real). **Recommend** two selectors/subscriptions: a high-frequency numeric (progress ring) and a low-frequency integer-second text, with explicit snapshot equality semantics, so text renders at 1 Hz by construction.

### S6 — Floating-point millisecond math needs an integer discipline and rounding policy
Countdown markers at `endMs − {10,5,…}s` and boundary comparisons are floating-point ms. With non-round durations, boundary/countdown detection can be off by a second or double-fire at the edge. **Recommend** an explicit **integer-millisecond** discipline for all offsets and a documented rounding rule for `remainingSeconds` (single canonical `ceil` at the display edge only), specified in `ENGINE.md` and pinned by boundary tests.

### S7 — Mixed wall-clock and monotonic time inside one immutable `SessionSnapshot`
`ENGINE.md` §7 stamps `startedAt`/`endedAt` from `Date.now()` (host) while all durations come from the monotonic clock. A system-clock change or DST shift mid-session yields an internally inconsistent snapshot. **Recommend** store the monotonic anchor plus a single wall-clock capture, derive display times from their delta, and document clock-change resilience.

### S8 — Subscriber failures are swallowed with no health signal
`EVENT_MODEL.md` §4 wraps subscribers in `try/catch` and "logs and skips." For a coaching app, a silently failing Coach subscriber is a silent workout — the exact failure the product cannot tolerate — with no surfaced signal. **Recommend** a subscriber-health/observability channel (error counts, a degraded-mode signal the UI can show: "voice coaching unavailable"), not just a console log.

---

## 3. Nice to Have

- **N1 — Compositional segments.** The flat `warmup/round/rest` Timeline can't express supersets, circuits, sub-intervals within a round, or multi-part/program sessions. If any of these are plausible in 5 years, a **recursive Segment** (a segment may contain child segments) is far cheaper to design in now than to retrofit into an offset array. At least record the decision.
- **N2 — Parity harness pins *intended*, not current, behaviour.** `IMPLEMENTATION_PLAN.md` §4 makes the PR-001 flow the safety net, but that flow has deliberate stopgaps (announcement-only warmup, trailing-rest guard). Pinning them risks cementing bugs as requirements. Attach a documented "intentional differences" list to the harness.
- **N3 — Config normalization vs existing validation.** `normalize()` overlaps `lib/validation.ts`; unify to avoid two sources of truth for "what is a valid workout."
- **N4 — Analytics identity/idempotency.** Fire-and-forget analytics with no stable session/idempotency keys will produce dirty data once retries/sync exist. Define IDs now even if analytics is later.
- **N5 — Separate "scheduler" from "state projection."** The engine mixes the FSM `reducer` with marker-crossing logic in `engine.ts`. A cleaner split (pure *scheduler*: elapsed → due events; pure *projection*: elapsed → phase) would sharpen testability and make the adaptive model (M1) easier.

---

## 4. Questions for the ADRs (must be answered before or within ADR-0001)

1. **Determinism vs adaptivity (the central question).** Is deterministic replay of a *fixed* timeline a hard, permanent requirement, or a best-effort property that will be relaxed once sensors/AI drive the session? The answer decides M1 and the entire shape of the core types. This deserves its **own ADR** (ADR-0002: Adaptive vs Deterministic Execution).
2. **Was an event-sourced / command-log core considered?** (See Alt-A below.) The ADR compared FSM *shapes* but not the *sourcing model*. Given sync, replay, wearables, crash recovery, and AI-over-history, this is the most consequential omitted alternative. Please record why snapshot-state was chosen over an event log.
3. **What is the actual target device/browser matrix?** Wake Lock availability, background-audio behaviour, and Worker throttling differ sharply across iOS Safari / Android Chrome / desktop. M2's resolution depends on this; the ADR assumes capabilities it never enumerates.
4. **Should the engine run off the main thread (Web Worker) from day one?** It's designed framework-free specifically so it *could*. Deciding "yes" now aligns with M2 and avoids a later port; deciding "no" should be explicit.
5. **Where do localization and content resolution live?** (S4.) Countdown/number wording and cue text are English today; the event model bakes that in.
6. **What durability guarantee do sessions get?** (M4.) At-least-once persisted? Resumable? This is a product promise, not just an implementation detail.
7. **Single workout vs composition/programs.** (N1.) Is the core scope one flat workout forever, or should composition be a first-class concept now?

---

## 5. Alternative worth a first-class evaluation

**Alt-A — Event-sourced core (command log as the source of truth).**
Instead of "mutable state object + ephemeral event bus," make an **append-only log of inputs** (commands + ticks) the canonical truth, with the reducer as a pure fold `state = reduce(log)`. Domain events become a derived projection.

- **Directly addresses:** M3 (replay/transport, remote subscribers get replay-from-seq for free), M4 (crash recovery = rehydrate from the log; resume is trivial), S3 (async projections over the log), and the AI-Coach "reason over history" need.
- **Costs:** log growth/compaction, more upfront machinery, and it makes M1's adaptivity *more* interesting (recompile = append a `Retime` command). 
- **Why it belongs in the ADR:** for a 5-year horizon whose headline features are sync + wearables + AI + recovery, an event-sourced core is arguably a better "single source of truth" than the proposed snapshot core — and it is exactly the kind of foundational choice that is nearly free to adopt at design time and extremely expensive to introduce later. **At minimum, ADR-0001 should record why it was not chosen.**

---

## 6. Summary table

| ID | Category | Finding (one line) | Reshapes core types? |
|---|---|---|---|
| M1 | Must Fix | Absolute-offset Timeline can't express predicate/open-ended (HR/punch/AI) segments | **Yes** |
| M2 | Must Fix | rAF tick source can't coach with screen off; timely audio wrongly depends on optional Wake Lock | **Yes** (tick source) |
| M3 | Must Fix | Sync/no-replay event model contradicts wearable/sync/recovery; no schema versioning | **Yes** (delivery + schemas) |
| M4 | Must Fix | Crash/abandon → no persisted session, no resume; History store unspecified | No |
| S1 | Should Fix | `drop-if-stale` drops coaching cues, not just countdown | No |
| S2 | Should Fix | Host loop/visibility/wake-lock excluded from real tests | No |
| S3 | Should Fix | Sync delivery couples subscriber latency/reentrancy into timing | No |
| S4 | Should Fix | Eager content resolution couples engine to content/i18n | No |
| S5 | Should Fix | Single per-frame snapshot defeats 1 Hz coalescing | No |
| S6 | Should Fix | Float-ms math lacks integer discipline/rounding policy | No |
| S7 | Should Fix | Mixed wall-clock/monotonic in one immutable snapshot | No |
| S8 | Should Fix | Subscriber failures swallowed; no health signal | No |
| N1–N5 | Nice to Have | Composition, parity intent, normalize dedup, analytics identity, scheduler/projection split | Some |
| Q1–Q7 | Questions | Determinism-vs-adaptivity, event-sourcing, device matrix, Worker, i18n, durability, composition | — |

**Bottom line:** approve the *fixed-workout* core to proceed **after** ADR-0001 resolves or explicitly defers M1–M3 (the three that touch core types) and assigns an owner for M4. The Should-Fix items can be handled inside the engine track. The one thing I would not let ship without an answer is **Question 1** — it is the difference between building the coaching platform the roadmap describes and building a very good deterministic interval timer.
