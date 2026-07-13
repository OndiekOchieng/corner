'use client';

import { useEffect, useState } from 'react';
import type { MediaDiagnosticsSnapshot } from '@/src/lib/media';
import type { WorkoutSnapshot } from '@/src/lib/engine';

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-white/45">{k}:</span> {v}
    </div>
  );
}

interface Props {
  getMediaDiagnostics: () => MediaDiagnosticsSnapshot | null;
  workout: WorkoutSnapshot;
}

/**
 * A tiny, dev-only heads-up overlay for the cross-platform audit: platform,
 * capabilities, audio/speech/wake-lock state, voices, and the live workout state.
 * Polls at ~2 Hz. Never rendered in production.
 */
export function WorkoutDiagnostics({ getMediaDiagnostics, workout }: Props) {
  const [media, setMedia] = useState<MediaDiagnosticsSnapshot | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!IS_DEV) return;
    const tick = () => setMedia(getMediaDiagnostics());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [getMediaDiagnostics]);

  if (!IS_DEV) return null;

  return (
    <div className="fixed bottom-2 left-2 z-50 max-w-[92vw] rounded-lg bg-black/85 p-2 font-mono text-[10px] leading-tight text-white/90 ring-1 ring-white/20">
      <button onClick={() => setOpen((o) => !o)} className="mb-1 font-bold tracking-wide text-white">
        DIAG {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="space-y-0.5">
          <Row k="platform" v={platformLabel()} />
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
              <Row k="wakelock" v={media.wakeLockStatus} />
            </>
          ) : (
            <Row k="media" v="(initializing…)" />
          )}
        </div>
      )}
    </div>
  );
}
