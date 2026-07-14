'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UpLink } from '@/components/ui/UpLink';
import { PageContainer } from '@/components/ui/PageContainer';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COACH_LABELS } from '@/lib/constants';
import { formatDuration } from '@/lib/formatting';
import { useWorkout } from '@/hooks';
import { createHistoryService } from '@/src/lib/integration';
import type { SessionSummary } from '@/src/lib/session';
import { Flame, Star } from 'lucide-react';

function formatDate(ms: number): string {
  if (!ms || ms < 1_000_000_000_000) return ''; // not a wall-clock timestamp
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`size-4 ${n <= rating ? 'fill-success text-success' : 'text-muted'}`}
        />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const { workouts } = useWorkout();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  // Read the canonical Session Runtime store (completed sessions, newest first).
  useEffect(() => {
    let alive = true;
    createHistoryService()
      .listSessions()
      .then((list) => {
        if (!alive) return;
        const completed = list
          .filter((s) => s.status === 'completed')
          .sort((a, b) => b.savedAt - a.savedAt);
        setSessions(completed);
      })
      .catch(() => {
        if (alive) setSessions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const nameFor = (workoutId: string) =>
    workouts.find((w) => w.id === workoutId)?.name ?? 'Workout';

  return (
    <PageContainer>
      <header className="mb-10">
        <UpLink href="/" label="Home" />
        <h1 className="mt-3 text-4xl font-bold tracking-tight">History</h1>
        <p className="mt-2 text-muted-foreground">
          Every session you finish, kept in your corner.
        </p>
      </header>

      {sessions === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="animate-rise rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10 elevate-1">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary">
            <Flame className="size-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Your first round starts it all</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Finish a session and it lands here — the workout, the coach, and the work
            you&apos;ve put in.
          </p>
          <Link
            href="/workouts"
            className={cn(buttonVariants(), 'mt-6 h-14 rounded-2xl bg-primary px-8 text-base font-semibold')}
          >
            Choose a workout
          </Link>
        </div>
      ) : (
        <ul className="animate-rise space-y-3">
          {sessions.map((s) => {
            const date = formatDate(s.savedAt);
            const coach = s.coach ? COACH_LABELS[s.coach] ?? s.coach : null;
            return (
              <li key={s.id} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{nameFor(s.workoutId)}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {[coach, date].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {s.rating != null && <RatingStars rating={s.rating} />}
                </div>
                <dl className="mt-3 flex gap-6">
                  <div>
                    <dt className="eyebrow">Time</dt>
                    <dd className="font-medium tabular-nums">
                      {formatDuration(Math.round(s.durationMs / 1000))}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Rounds</dt>
                    <dd className="font-medium tabular-nums">{s.completedRounds}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
