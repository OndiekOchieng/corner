'use client';

import { useParams } from 'next/navigation';
import { WorkoutDetail } from '@/components/WorkoutDetail/WorkoutDetail';
import { PageContainer } from '@/components/ui/PageContainer';
import { useWorkout } from '@/hooks';

export default function WorkoutDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { loadWorkoutById, loading, error } = useWorkout();
  const workout = loadWorkoutById(id);

  if (loading) {
    return (
      <PageContainer center>
        <p className="text-muted-foreground">Loading workout...</p>
      </PageContainer>
    );
  }

  if (error || !workout) {
    return (
      <PageContainer center>
        <div className="w-full rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-destructive">{error || 'Workout not found'}</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <WorkoutDetail workout={workout} />
    </PageContainer>
  );
}
