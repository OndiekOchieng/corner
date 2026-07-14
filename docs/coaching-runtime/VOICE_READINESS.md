# Voice Readiness — Design (PR-020)

**Status:** Proposed. Design + product decision, no implementation (see the smallest
follow-up PR at the end). This document traces why the first coaching line can be
spoken in the wrong voice, and specifies a browser-free "Voice Ready" contract and a
startup policy that fixes it without touching the Engine, Event Runtime, or the
existing boundaries.

Related: [ARCHITECTURE.md](../ARCHITECTURE.md) ·
[SESSION_INTRODUCTIONS.md](SESSION_INTRODUCTIONS.md) ·
[../media-runtime/IMPLEMENTATION.md](../media-runtime/IMPLEMENTATION.md)

---

## The lifecycle, end to end

```
Settings (usePreferences.voiceURI, default null)
   │
ActiveRunner → useCoachedWorkout(settings)
   │
   ├─ build effect:  media.configureSpeech(speechSettings)      hooks/useCoachedWorkout.ts:104
   │     → SpeechManager.configure()                            src/lib/media/SpeechManager.ts:107
   │        → engine.setVoice(voiceURI)                         SpeechManager.ts:112
   │           → SpeechService.setVoice(voiceURI)               lib/speech/SpeechService.ts:197
   │              pendingVoiceURI = voiceURI
   │              match = this.voices.find(v.voiceURI === uri)  ← this.voices may be [] on Chrome
   │              if (match) selectedVoice = match              ← else selectedVoice stays null
   │
   ├─ controller.start()  (SYNCHRONOUS)                         useCoachedWorkout.ts:143
   │     → WORKOUT_STARTED → Coach → workout_intro → speak()
   │        → buildUtterance():                                 SpeechService.ts:309
   │             if (selectedVoice) utterance.voice = selectedVoice   ← null ⇒ BROWSER DEFAULT
   │
   └─ void media.unlock()  (parallel, AFTER start)             useCoachedWorkout.ts:144
         → SpeechManager.warm() → SpeechService.warm()         SpeechService.ts (warm)
            → loadVoices() = synth.getVoices()                 ← still possibly []
   ...later, asynchronously...
   synth.onvoiceschanged → loadVoices()                        SpeechService.ts:145,391
      → getVoices() now populated
      → resolves pendingVoiceURI → selectedVoice = match       SpeechService.ts:395-396
      → subsequent utterances use the coach voice
```

## Q1 — When does the selected voice become available?

Voice availability is **browser-dependent and asynchronous on Chrome**:

- **Chrome / Chromium (incl. Android):** `speechSynthesis.getVoices()` returns `[]`
  until the engine populates them and fires the `voiceschanged` event — typically
  tens to hundreds of milliseconds after the API is first touched, and only after
  it is touched. `selectedVoice` can only resolve at or after that event.
- **Safari / most desktops:** voices are usually available synchronously on the first
  `getVoices()`, so `selectedVoice` resolves during `configure()` and the race
  never appears.

```
sequence (Chrome, fresh document)

Settings        SpeechService        window.speechSynthesis        Coach/Engine
   │  voiceURI        │                       │                          │
   │────configure────▶│                       │                          │
   │                  │──getVoices()─────────▶│                          │
   │                  │◀──── [] (empty) ──────│                          │
   │                  │ pendingVoiceURI set, selectedVoice = null        │
   │                  │                       │       controller.start() │
   │                  │◀──────────────── speak(intro) ───────────────────│
   │                  │ buildUtterance(): selectedVoice null ⇒ DEFAULT   │
   │                  │──speak(default voice)▶│  🔊 wrong voice          │
   │                  │                       │                          │
   │                  │◀── voiceschanged ─────│  (async, later)          │
   │                  │──getVoices()─────────▶│                          │
   │                  │◀── [voices…] ─────────│                          │
   │  loadVoices(): pendingVoiceURI → selectedVoice = match              │
   │                  │  next utterances now use the coach voice 🔊 ✓    │
```

## Q2 — Why is the first utterance sometimes the default voice?

It is a **compound** of three real causes; not a configure-ordering bug and not a bug
in our race handling per se, but an unguarded reliance on async browser voice load:

1. **`voiceschanged` arrives later (primary).** On Chrome the voice list is empty when
   `setVoice()` runs, so no match is found. `SpeechService.setVoice()` — `lib/speech/SpeechService.ts:197-205`:
   ```
   this.pendingVoiceURI = voiceURI;
   const match = this.voices.find((v) => v.voiceURI === voiceURI);
   if (match) this.selectedVoice = match;   // no match yet ⇒ selectedVoice stays null
   ```
2. **`selectedVoice` is unresolved at first speak.** It only resolves in `loadVoices()`
   on `voiceschanged` — `SpeechService.ts:391-396`:
   ```
   this.voices = this.synth.getVoices() ?? [];
   if (this.pendingVoiceURI && !this.selectedVoice) this.setVoice(this.pendingVoiceURI);
   ```
3. **`buildUtterance()` snapshots the voice too early.** The voice is read at `speak()`
   time — `SpeechService.ts:309-316` — and the first `speak()` is the `workout_intro`
   fired synchronously by `controller.start()` (`useCoachedWorkout.ts:143`), **before**
   `media.unlock()`/`warm()` (line 144) and long before `voiceschanged`:
   ```
   if (this.selectedVoice) utterance.voice = this.selectedVoice;   // null ⇒ default
   ```

**Ruled out:** *"SpeechManager configures after workout start"* — `configureSpeech()`
runs at build (line 104), *before* `start()` (line 143). Config order is correct; the
voice list simply isn't loaded yet. The Start-button `primeSpeechFromGesture()` calls
`getVoices()` during the gesture, which *kicks* the async load earlier and often hides
the race — but it cannot guarantee voices are ready by the time the next page mounts
and starts. So the failure is intermittent (a race we don't gate on), which matches
the report.

## Q3 — The "Voice Ready" contract

The workout should **ask** readiness, not guess. The Media Runtime already knows
everything needed (`SpeechManager.isVoicesReady()`, `voiceCount()`, `selectedVoice()`);
surface it upward as a **browser-free** port — plain DTOs, never `SpeechSynthesisVoice`.

```ts
// Exposed by MediaRuntime (browser stays below this line)
interface VoiceReadiness {
  /** True once voices are loaded AND the chosen voice is resolved (or 'default' is the choice). */
  voiceReady(): boolean;
  voiceStatus(): 'unsupported' | 'loading' | 'ready-default' | 'ready-selected';
  /** The resolved voice as a plain shape, or null when the browser default is in use. */
  selectedVoice(): VoiceInfo | null;
  /** All voices as browser-free DTOs (for the settings picker). */
  availableVoices(): readonly VoiceInfo[];
  /** Notify when readiness flips (wraps onvoiceschanged); returns an unsubscribe. */
  onVoiceReady(listener: () => void): () => void;
}

interface VoiceInfo {           // a plain DTO — no browser types leak upward
  readonly id: string;          // voiceURI
  readonly name: string;
  readonly lang: string;
  readonly isDefault: boolean;
  readonly localService: boolean;
}
```

- **Ownership:** the Media Runtime owns voice readiness (it owns the browser). It maps
  `SpeechSynthesisVoice → VoiceInfo` internally so nothing above the media boundary
  ever sees a browser type. The Coach Runtime and composition consume only this port.
- **No leakage:** `voiceReady()`/`voiceStatus()` are booleans/enums; `VoiceInfo` is a
  DTO. This satisfies the layering rule (browser APIs stay at the edge).

## Q4 — Startup policy

| | **A — Wait for voice** | **B — Default for the whole workout** | **C — Start now, defer only the intro** |
|---|---|---|---|
| Mechanism | Block `start()` ≤500–1000 ms until voice ready | Ignore the chosen voice; use default throughout | Engine/timer start immediately; hold **only** the first spoken line until `voiceReady()` (bounded ~800 ms, then speak in whatever's ready) |
| Athlete experience | Whole workout feels laggy to begin | Wrong voice all session — defeats the setting | Correct voice from the first word; timer is instant |
| Responsiveness | ✗ delays timer + first bell "just because" | ✓ instant | ✓ instant (only the intro waits a beat, which reads as a natural pause) |
| Consistency | ✓ correct voice | ✗ never the coach voice | ✓ correct voice, with a bounded fallback if voices never load |
| Complexity | Low, but violates "never gate the workout on media" (PR-013) | Trivial, but wrong product | Moderate; localized to the media/speech layer + one gate flag |

**Recommendation: Option C.** It is the only option that keeps the timer instant
*and* delivers the chosen coach voice from the very first word. It aligns with the
established principle from PR-013 — *never gate the workout on audio/media* — by
gating **only** the introductory utterance, never the engine. The bounded fallback
guarantees the intro is never lost: if `voiceReady()` hasn't flipped within the
window, the intro speaks in the default voice rather than waiting indefinitely. A
coach taking a half-second breath before "Round one" is natural; a laggy timer is not.

C also composes cleanly with [SESSION_INTRODUCTIONS.md](SESSION_INTRODUCTIONS.md): the
introduction becomes a distinct, gate-able unit, so "defer only the intro" has a
clean object to defer.

## Where the gate lives (keeping the coach pure)

The Coach Runtime is deterministic — no timers, no async. So the **bounded wait lives
in the Media Runtime** (the browser edge), not in the coach:

- The Coach Runtime **declares** intent: the `workout_intro` action carries a
  deterministic `requiresVoice: true` marker (authoring metadata).
- The Media Runtime **enforces** timing: `SpeechManager` holds the first
  `requiresVoice` utterance until `voiceReady()` or the bounded timeout, then speaks.

The coach stays pure (it only tags the action); the browser-timing concern stays in
the browser layer. No `Date.now()`/timers enter the Coach Runtime or Engine.

## Smallest follow-up implementation PR

Two small, independent slices (the second is optional polish):

1. **Voice Ready contract + first-utterance gate (the fix).** Add the `VoiceReadiness`
   port to `MediaRuntime` (surfacing existing `SpeechManager` internals as DTOs), and
   have `SpeechManager`/`SpeechService` hold the **first** utterance until
   `voiceReady()` or an ~800 ms bounded fallback. No Engine, Event Runtime, Coach
   Runtime, or hook changes required — entirely within the media/speech layer.
2. *(Optional)* surface `voiceStatus()` in the dev diagnostics overlay for on-device
   confirmation.

This resolves the visible voice bug with the smallest possible surface. The Session
Introduction restructure is a separate, larger PR.
