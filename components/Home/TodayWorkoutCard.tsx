'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Workout } from '@/types/workout';
import { formatRoundTime } from '@/lib/formatting';
import { STANCE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';

interface TodayWorkoutCardProps {
  workout: Workout;
}

export function TodayWorkoutCard({ workout }: TodayWorkoutCardProps) {
  const totalTime = formatRoundTime(
    workout.roundDuration,
    workout.restDuration,
    workout.roundCount,
  );

  return (
    <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 elevate-2">
      <div className="p-6 md:p-8">
        <p className="eyebrow mb-3">Today&apos;s session</p>
        <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
          {workout.name}
        </h2>
        <p className="mt-2 text-muted-foreground">{workout.description}</p>

        <dl className="mt-6 grid grid-cols-3 gap-4">
          <div>
            <dt className="eyebrow mb-1">Time</dt>
            <dd className="text-xl font-bold tabular-nums">{totalTime}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Rounds</dt>
            <dd className="text-xl font-bold tabular-nums">{workout.roundCount}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Stance</dt>
            <dd className="text-xl font-bold">{STANCE_LABELS[workout.stance]}</dd>
          </div>
        </dl>
      </div>

      <Link
        href={`/workout/${workout.id}`}
        className={cn(
          buttonVariants(),
          'h-16 w-full gap-2 rounded-none rounded-b-3xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90',
        )}
      >
        <Play className="size-5 fill-current" />
        Start workout
      </Link>
    </section>
  );
}
