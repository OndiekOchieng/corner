'use client';

import { useEffect, useState } from 'react';
import { getDevWorkoutStory, type DevWorkoutStory } from '@/src/lib/recorder';

/** Development-only. Stripped from production (see the guard). */
const IS_DEV = process.env.NODE_ENV !== 'production';

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DOT: Record<DevWorkoutStory['verdicts'][number]['status'], string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  off: 'text-white/40',
};
const MARK: Record<DevWorkoutStory['verdicts'][number]['status'], string> = {
  ok: '✓',
  warn: '⚠',
  off: '–',
};

/**
 * Developer Workout Story — the post-workout outcome digest, on the Finish page,
 * where the developer already lands. Answers "what happened?" so they never say
 * "no idea." DEV ONLY; reads a one-shot in-memory snapshot (no persistence — a
 * refresh forgets it, and this renders nothing).
 */
export function DeveloperWorkoutStory() {
  const [story, setStory] = useState<DevWorkoutStory | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (IS_DEV) setStory(getDevWorkoutStory());
  }, []);

  if (!IS_DEV || !story) return null;

  const copy = () =>
    void navigator.clipboard?.writeText(story.storyMarkdown).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );

  return (
    <div className="mt-8 rounded-2xl bg-black/85 p-4 font-mono text-[11px] leading-tight text-white/90 ring-1 ring-white/15">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold tracking-wide text-white">DEVELOPER WORKOUT STORY</span>
        <span className="text-white/40">{story.title}</span>
      </div>

      {/* The digest — one honest verdict per subsystem. */}
      <ul className="space-y-1">
        {story.verdicts.map((v) => (
          <li key={v.label} className="flex gap-2">
            <span className={`w-3 ${DOT[v.status]}`}>{MARK[v.status]}</span>
            <span className="w-20 text-white/60">{v.label}</span>
            <span className="text-white/85">{v.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-2">
        <button onClick={() => setExpanded((e) => !e)} className="text-white/70 underline decoration-dotted hover:text-white">
          {expanded ? 'hide timeline' : 'view timeline'}
        </button>
        <button onClick={copy} className="text-white/70 underline decoration-dotted hover:text-white">
          {copied ? 'copied ✓' : 'copy'}
        </button>
        <button
          onClick={() => download('workout-story.md', story.storyMarkdown, 'text/markdown')}
          className="text-white/70 underline decoration-dotted hover:text-white"
        >
          .md
        </button>
        <button
          onClick={() => download('workout-story.json', story.storyJson, 'application/json')}
          className="text-white/70 underline decoration-dotted hover:text-white"
        >
          .json
        </button>
      </div>

      {expanded && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white/5 p-2 text-white/75">
          {story.storyMarkdown}
        </pre>
      )}
    </div>
  );
}
