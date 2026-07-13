'use client';

import { Workout } from '@/types/workout';
import { WorkoutCard } from './WorkoutCard';

interface WorkoutLibraryProps {
  workouts: Workout[];
}

export function WorkoutLibrary({ workouts }: WorkoutLibraryProps) {
  if (!workouts || workouts.length === 0) {
    return (
      <div className="rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
        <p className="eyebrow mb-2">Nothing here yet</p>
        <p className="text-muted-foreground">
          Your workouts will appear here once they&apos;re ready.
        </p>
      </div>
    );
  }

  return (
    <div className="grid animate-rise grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workouts.map((workout) => (
        <WorkoutCard key={workout.id} workout={workout} />
      ))}
    </div>
  );
}
