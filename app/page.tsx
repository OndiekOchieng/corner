'use client';

import { HomeScreen } from '@/components/Home/HomeScreen';
import { useWorkout, useLocalStorage } from '@/hooks';

export default function Page() {
  const { workouts, loading } = useWorkout();
  const [selectedWorkoutId] = useLocalStorage<string | null>('selectedWorkoutId', null);

  const todayWorkout = selectedWorkoutId
    ? workouts.find((w) => w.id === selectedWorkoutId)
    : undefined;

  return (
    <main className="screen mx-auto max-w-2xl px-5 py-12 md:px-8">
      {loading ? (
        <div className="space-y-8">
          <div className="h-12 w-40 animate-pulse rounded-xl bg-card" />
          <div className="h-72 animate-pulse rounded-3xl bg-card" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-14 animate-pulse rounded-2xl bg-card" />
            <div className="h-14 animate-pulse rounded-2xl bg-card" />
          </div>
        </div>
      ) : (
        <HomeScreen todayWorkout={todayWorkout} />
      )}
    </main>
  );
}
