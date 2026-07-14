# Voice Readiness — Implementation (PR-020A)

The Media Runtime now guarantees the coach's **first line is spoken in the athlete's
selected voice whenever reasonably possible**, without ever delaying the workout. This
implements the contract designed in
[`../coaching-runtime/VOICE_READINESS.md`](../coaching-runtime/VOICE_READINESS.md).

Scope: **Media Runtime only** — `lib/speech/SpeechService.ts` (the speech boundary),
`src/lib/media/{SpeechManager,MediaRuntime,MediaDiagnostics}.ts`. The Engine, Host,
Event, Coach, and Session runtimes are untouched, and the workout/timer still starts
immediately.

---

## The problem (recap)

On Chrome, `getVoices()` is empty until `voiceschanged` fires. The coach's intro is
spoken synchronously at `controller.start()` — before voices load — so it went out in
the **browser default** voice, then later lines switched to the selected voice. That
switch breaks immersion.

## The fix — a startup gate on the first utterance only

`SpeechService` holds **only the first (introductory) utterance** until the selected
voice resolves, up to a bounded timeout. Everything else — the timer, the bells, the
engine — is unaffected (it lives above this layer and is never gated).

```
first speak() ─▶ pump() ─▶ gatingFirstUtterance()?
                              ├─ voiceReady()  → releaseIntro() → speak in selected voice
                              └─ not ready     → armVoiceGate():
                                                   • schedule ~800 ms timeout
                                                   • loadVoices() (on voiceschanged) may
                                                     releaseIntro() earlier if it resolves
                              releaseIntro():
                                • LOCK the session voice (selected, or null=default)
                                • record resolutionMs + fallbackUsed
                                • pump() the held utterance
subsequent speak() ─▶ pump() ─▶ introReleased → speak in the LOCKED voice (no re-check)
```

### Voice consistency (never switch mid-session)

At `releaseIntro()` the effective voice is **locked** (`lockedVoice`, `voiceLocked`).
Every later utterance uses the locked voice, and the voice is applied at **dispatch
time** in `pump()` (not at build time), so a `voiceschanged` that arrives after the
lock can never switch voices mid-workout. *Consistency beats perfection.*

Because a fresh `SpeechService` is constructed per workout (the `useCoachedWorkout`
build effect), the lock is naturally session-scoped — no reset logic needed.

### Startup policy (as specified)

- Timer/workout: **immediate** (unchanged; not this layer's concern).
- Intro line: **wait until `voiceReady()` OR ~800 ms**, then speak.
- On timeout: speak in the browser default **and keep it for the whole session**.

## Voice lifecycle handling

Voices are resolved once and cached; `getVoices()` is not re-searched per utterance.

| Situation | Behaviour |
|---|---|
| Selected voice already loaded | `voiceReady()` true → intro speaks immediately in it |
| Voices load later (`voiceschanged`) | intro held, released the instant the voice resolves |
| Timeout (voices never load) | intro speaks in default; default locked for the session |
| Requested voice unavailable / deleted | `voiceReady()` true (don't wait) → default, `fallbackUsed=true` |
| No voice selected (default) | never gates — `voiceReady()` true immediately |
| Unsupported engine | `voiceReady()` true (nothing to wait for); status `unsupported` |

## The browser-free contract (exposed by `MediaRuntime`)

No `SpeechSynthesisVoice` leaks above the speech boundary — only plain DTOs.

```ts
MediaRuntime.voiceReady(): boolean
MediaRuntime.voiceStatus(): 'unsupported' | 'loading' | 'ready-default' | 'ready-selected'
MediaRuntime.selectedVoice(): VoiceInfo | null        // null = browser default
MediaRuntime.availableVoices(): readonly VoiceInfo[]
MediaRuntime.voiceReadiness(): VoiceReadinessDiagnostics

interface VoiceInfo { id: string; name: string; lang: string; isDefault: boolean; localService: boolean }
```

`SpeechManager` forwards these to the `SpeechService`, degrading to safe defaults for
engines that don't implement the contract (test fakes → always "ready").

## Diagnostics (browser-edge only)

`MediaDiagnostics` snapshot gains five fields, refreshed live in
`MediaRuntime.diagnostics()`:

| Field | Meaning |
|---|---|
| `voiceReady` | is the session voice resolved / decided |
| `selectedVoice` | effective voice name (or null = default) |
| `voiceResolutionMs` | ms from session start to the locked voice (null until locked) |
| `voiceFallbackUsed` | a specific voice was requested but the session used default |
| `voiceSource` | `selected` \| `default` \| `fallback` \| `pending` \| `unsupported` |

## Determinism & testability

The gate uses an **injected** timeout scheduler and clock (`scheduleTimeout`, `now` on
`SpeechServiceConfig`), defaulting to `setTimeout`/`performance.now`. Tests drive the
timeout and `voiceschanged` explicitly, so behaviour is fully deterministic. (These
injections live at the browser edge — the Engine/Coach determinism contract is
unaffected.)

## Tests (`lib/speech/__tests__/SpeechService.test.ts`)

✓ selected voice already available · ✓ voices load later · ✓ timeout fallback ·
✓ unavailable selected voice · ✓ browser default (never gates) · ✓ no mid-workout
voice switching · ✓ voice locked for subsequent lines · ✓ deterministic outcome.
Full suite: **245 passing**, `tsc` clean, production build green.

## What was NOT changed

The Coach Runtime still calls `sink.speak(text)` with no knowledge of voices or timing
— the gate lives entirely below the `SpeechSink`. No Engine, Host, Event, or Session
change. The intro is identified simply as the **first utterance of the per-workout
`SpeechService` instance**, so no coach-side tagging was required for this slice.
