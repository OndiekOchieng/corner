'use client';

import { useEffect, useState } from 'react';
import type { MediaDiagnosticsSnapshot } from '@/src/lib/media';
import type { WorkoutSnapshot } from '@/src/lib/engine';
import type { SpeechPipelineTrace } from '@/hooks/useCoachedWorkout';

/** Development-only. Stripped from production builds (see the guard + mount gate). */
const IS_DEV = process.env.NODE_ENV !== 'production';

function platformLabel(): string {
  if (typeof navigator === 'undefined') return 'server';
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Macintosh/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : 'other';
  const browser = /CriOS/.test(ua)
    ? 'Chrome'
    : /Edg/.test(ua)
      ? 'Edge'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome/.test(ua)
          ? 'Chrome'
          : /Safari/.test(ua)
            ? 'Safari'
            : 'other';
  return `${browser} · ${os}`;
}

const yn = (v: boolean) => (v ? '✓' : '✗');

/** Inferred iOS version from the UA (e.g. "iPhone OS 17_1" → "17.1"); best-effort. */
function iosVersion(): string {
  if (typeof navigator === 'undefined') return 'n/a';
  const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  return m ? `${m[1]}.${m[2]}` : '—';
}

/** Once-off platform facts for the wake-lock investigation (PR-025 acceptance). */
function platformFacts() {
  if (typeof window === 'undefined') return { secure: 'n/a', wakeLockApi: 'n/a', vis: 'n/a', focus: 'n/a' };
  return {
    secure: String(window.isSecureContext),
    wakeLockApi: yn('wakeLock' in navigator),
    vis: typeof document !== 'undefined' ? document.visibilityState : 'n/a',
    focus: typeof document !== 'undefined' ? String(document.hasFocus()) : 'n/a',
  };
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-white/45">{k}:</span> {v}
    </div>
  );
}

interface Props {
  getMediaDiagnostics: () => MediaDiagnosticsSnapshot | null;
  getSpeechTrace: () => SpeechPipelineTrace;
  /** The full (verbose) workout story as markdown — Flight Recorder (PR-032/034). */
  getStory: () => string;
  /** The full workout story as JSON — Flight Recorder developer export (PR-034). */
  getStoryJson: () => string;
  workout: WorkoutSnapshot;
}

/** Download a string as a file (dev-only export). */
function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * A tiny, dev-only heads-up overlay for the cross-platform audit: platform,
 * capabilities, audio/speech/wake-lock state, voices, and the live workout state.
 * Polls at ~2 Hz. Never rendered in production.
 */
export function WorkoutDiagnostics({ getMediaDiagnostics, getSpeechTrace, getStory, getStoryJson, workout }: Props) {
  const [media, setMedia] = useState<MediaDiagnosticsSnapshot | null>(null);
  const [trace, setTrace] = useState<SpeechPipelineTrace | null>(null);
  const [story, setStory] = useState('');
  const [open, setOpen] = useState(true);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Flight Recorder (PR-034): the workout's story, right here in DIAG — so a strange
  // session can be *retold* instead of screenshotted. Copy or export it.
  const copyStory = () => {
    void navigator.clipboard?.writeText(getStory()).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  const exportMarkdown = () => download('workout-story.md', getStory(), 'text/markdown');
  const exportJson = () => download('workout-story.json', getStoryJson(), 'application/json');

  useEffect(() => {
    if (!IS_DEV) return;
    const tick = () => {
      setMedia(getMediaDiagnostics());
      setTrace(getSpeechTrace());
      setStory(getStory());
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [getMediaDiagnostics, getSpeechTrace, getStory]);

  if (!IS_DEV) return null;

  const svc = trace?.media?.service ?? null;
  const coach = trace?.coach ?? null;

  return (
    <div className="fixed bottom-2 left-2 z-50 max-w-[92vw] rounded-lg bg-black/85 p-2 font-mono text-[10px] leading-tight text-white/90 ring-1 ring-white/20">
      <div className="mb-1 flex items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} className="font-bold tracking-wide text-white">
          DIAG {open ? '▾' : '▸'}
        </button>
      </div>
      {open && (
        <div className="space-y-0.5">
          <Row k="platform" v={`${platformLabel()} · iOS:${iosVersion()}`} />
          <Row
            k="env"
            v={`secure:${platformFacts().secure} · wakeLock-api:${platformFacts().wakeLockApi} · vis:${platformFacts().vis} · focus:${platformFacts().focus}`}
          />
          <Row k="workout" v={`${workout.phase}/${workout.status} · ${workout.remainingSeconds}s`} />
          {media ? (
            <>
              <Row k="compat" v={media.browserCompatibility} />
              <Row
                k="caps"
                v={`speech:${yn(media.capabilities.speech)} audio:${yn(media.capabilities.webAudio)} wake:${yn(media.capabilities.wakeLock)}`}
              />
              <Row
                k="audio"
                v={`${media.audioState} · unlocked:${yn(media.audioUnlocked)} · resumes:${media.resumeCount} · fails:${media.autoplayFailures}`}
              />
              <Row
                k="speech"
                v={`avail:${yn(media.speechAvailable)} · ready:${yn(media.voicesReady)} · voices:${media.voiceCount} · ${media.selectedVoice ?? 'default'}`}
              />
              <Row
                k="wakelock"
                v={`${media.wakeLockStatus} · sup:${yn(media.wakeLockSupported)} held:${yn(media.wakeLockHeld)}`}
              />
              <Row
                k="wl request"
                v={`${media.wakeLockLastRequestOutcome ?? '—'}${media.wakeLockLastRequestMs != null ? ` in ${media.wakeLockLastRequestMs}ms` : ''}${media.wakeLockLastError ? ` · ${media.wakeLockLastError}` : ''}`}
              />
              <Row
                k="wl held"
                v={`${media.wakeLockHeldDurationMs != null ? `${media.wakeLockHeldDurationMs}ms` : '—'} · last release: ${media.wakeLockLastReleaseReason ?? '—'}${media.wakeLockLastReleaseVisibility ? ` (vis=${media.wakeLockLastReleaseVisibility})` : ''}`}
              />
              <Row
                k="wakelock counts"
                v={`req:${media.wakeLockRequested} acq:${media.wakeLockAcquired} rel:${media.wakeLockReleased} reacq:${media.wakeLockReacquired}`}
              />
            </>
          ) : (
            <Row k="media" v="(initializing…)" />
          )}

          {/* Speech-pipeline trace — proves where a coaching line stops. */}
          <div className="mt-1 border-t border-white/15 pt-1">
            {coach && (
              <Row
                k="coach"
                v={`produced:${coach.actionsGenerated} spoken:${coach.actionsSpoken} discarded:${coach.actionsDiscarded} q:${coach.queueDepth}`}
              />
            )}
            {svc ? (
              <>
                <Row k="service" v={`#${svc.instanceId} speak():${svc.speakCalls} → synth.speak():${svc.synthSpeakCalls}`} />
                <Row
                  k="utterance"
                  v={`onstart:${svc.started} onend:${svc.ended} onerror:${svc.errors} · qlen:${svc.queueLength}`}
                />
                <Row k="current" v={svc.currentText ?? '—'} />
                <Row
                  k="ids"
                  v={`mgr#${trace?.media?.speechManagerId ?? '?'} · svc#${trace?.media?.speechServiceId ?? '?'} · ${svc.speaking ? 'speaking' : 'idle'}${svc.paused ? '·paused' : ''}`}
                />
              </>
            ) : (
              <Row k="service" v="(no SpeechService)" />
            )}
          </div>

          {/* Flight Recorder — the story of this workout, in one place (PR-034). */}
          <div className="mt-1 border-t border-white/15 pt-1">
            <button
              onClick={() => setRecorderOpen((o) => !o)}
              className="font-bold tracking-wide text-white/90"
            >
              FLIGHT RECORDER {recorderOpen ? '▾' : '▸'}
            </button>
            {recorderOpen && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-3">
                  <button onClick={copyStory} className="text-white/70 underline decoration-dotted hover:text-white">
                    {copied ? 'copied ✓' : 'copy'}
                  </button>
                  <button onClick={exportMarkdown} className="text-white/70 underline decoration-dotted hover:text-white">
                    .md
                  </button>
                  <button onClick={exportJson} className="text-white/70 underline decoration-dotted hover:text-white">
                    .json
                  </button>
                </div>
                {/* Workout Timeline — the full, unfiltered story. */}
                <pre className="max-h-48 max-w-[88vw] overflow-auto whitespace-pre-wrap break-words rounded bg-white/5 p-1.5 text-white/80">
                  {story || '(nothing recorded yet)'}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
