'use client';

import Link from 'next/link';
import { Workout } from '@/types/workout';
import { formatRoundTime } from '@/lib/formatting';
import { DIFFICULTY_COLORS, STANCE_LABELS } from '@/lib/constants';
import { ChevronRight, Clock, Layers } from 'lucide-react';

interface WorkoutCardProps {
  workout: Workout;
}

export function WorkoutCard({ workout }: WorkoutCardProps) {
  const totalTime = formatRoundTime(
    workout.roundDuration,
    workout.restDuration,
    workout.roundCount,
  );

  return (
    <Link
      href={`/workout/${workout.id}`}
      className="group flex h-full flex-col justify-between gap-5 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 transition-all duration-200 hover:ring-foreground/25 hover:elevate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-push"
    >
      <div>
        {/* Goal-forward: the tags that describe the training intent lead. */}
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

        <h3 className="text-2xl font-bold tracking-tight text-balance">
          {workout.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {workout.description}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            <span className="font-medium tabular-nums text-foreground">{totalTime}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="size-4" />
            <span className="font-medium tabular-nums text-foreground">
              {workout.roundCount} rounds
            </span>
          </span>
        </div>
        <ChevronRight className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
