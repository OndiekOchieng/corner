'use client';

import { useParams } from 'next/navigation';
import { WorkoutDetail } from '@/components/WorkoutDetail/WorkoutDetail';
import { useWorkout } from '@/hooks';

export default function WorkoutDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { loadWorkoutById, loading, error } = useWorkout();
  const workout = loadWorkoutById(id);

  if (loading) {
    return (
      <main className="screen mx-auto max-w-2xl px-5 py-10 md:px-8">
        <p className="text-muted-foreground">Loading workout...</p>
      </main>
    );
  }

  if (error || !workout) {
    return (
      <main className="screen mx-auto max-w-2xl px-5 py-10 md:px-8">
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4">
          <p className="text-destructive">
            {error || 'Workout not found'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="screen mx-auto max-w-2xl px-5 py-10 md:px-8">
      <WorkoutDetail workout={workout} />
    </main>
  );
}
