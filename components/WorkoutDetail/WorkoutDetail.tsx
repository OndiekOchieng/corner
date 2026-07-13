'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { RoundPreview } from './RoundPreview';
import { Workout } from '@/types/workout';
import { formatRoundTime } from '@/lib/formatting';
import { STANCE_LABELS, DIFFICULTY_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { primeSpeechFromGesture } from '@/src/lib/media';
import { ChevronLeft, Play } from 'lucide-react';

interface WorkoutDetailProps {
  workout: Workout;
}

export function WorkoutDetail({ workout }: WorkoutDetailProps) {
  const totalTime = formatRoundTime(
    workout.roundDuration,
    workout.restDuration,
    workout.roundCount,
  );

  return (
    <div className="animate-rise space-y-8 pb-28">
      <Link
        href="/workouts"
        className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 gap-1.5 px-3')}
      >
        <ChevronLeft className="size-4" />
        Library
      </Link>

      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${DIFFICULTY_COLORS[workout.difficulty]}`}
          >
            {workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
            {STANCE_LABELS[workout.stance]}
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-balance">{workout.name}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{workout.description}</p>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-foreground/10 md:grid-cols-4">
        {[
          { label: 'Total', value: totalTime },
          { label: 'Rounds', value: String(workout.roundCount) },
          { label: 'Per round', value: `${Math.floor(workout.roundDuration / 60)}m` },
          { label: 'Rest', value: `${workout.restDuration}s` },
        ].map((stat) => (
          <div key={stat.label} className="bg-card p-5">
            <dt className="eyebrow mb-1">{stat.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h2 className="mb-4 text-xl font-bold tracking-tight">The rounds</h2>
        <RoundPreview rounds={workout.rounds} />
      </div>

      {/* Start is always reachable — pinned to the bottom of the viewport,
          aligned to the same content column as the cards above. */}
      <div className="page-gutter fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 pt-4 backdrop-blur-md [padding-bottom:max(env(safe-area-inset-bottom),1rem)]">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/workout/${workout.id}/active`}
            onClick={primeSpeechFromGesture}
            className={cn(
              buttonVariants(),
              'h-16 w-full gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90',
            )}
          >
            <Play className="size-5 fill-current" />
            Start workout
          </Link>
        </div>
      </div>
    </div>
  );
}
