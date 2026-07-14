'use client';

import { UpLink } from '@/components/ui/UpLink';
import { PageContainer } from '@/components/ui/PageContainer';
import { WorkoutLibrary } from '@/components/WorkoutLibrary/WorkoutLibrary';
import { useWorkout } from '@/hooks';

export default function WorkoutsPage() {
  const { workouts, loading, error } = useWorkout();

  return (
    <PageContainer width="wide">
      <header className="mb-10">
        <UpLink href="/" label="Home" />
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Library</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a session. Every one is built to be run hands-free.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10"
            />
          ))}
        </div>
      ) : (
        <WorkoutLibrary workouts={workouts} />
      )}
    </PageContainer>
  );
}
