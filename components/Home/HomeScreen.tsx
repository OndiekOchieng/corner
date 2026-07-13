'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { TodayWorkoutCard } from './TodayWorkoutCard';
import { Workout } from '@/types/workout';
import { Settings, Library, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeScreenProps {
  todayWorkout?: Workout;
}

export function HomeScreen({ todayWorkout }: HomeScreenProps) {
  return (
    <div className="animate-rise space-y-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Corner</h1>
          <p className="mt-1 text-muted-foreground">The coach in your corner.</p>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'size-12 rounded-xl',
          )}
        >
          <Settings className="size-6" />
        </Link>
      </header>

      {todayWorkout ? (
        <TodayWorkoutCard workout={todayWorkout} />
      ) : (
        <div className="rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10 elevate-1">
          <p className="eyebrow mb-2">Ready when you are</p>
          <p className="mb-6 text-lg text-muted-foreground">
            Pick a session, press start, put the phone down.
          </p>
          <Link
            href="/workouts"
            className={cn(
              buttonVariants(),
              'h-14 rounded-2xl bg-primary px-8 text-lg font-semibold',
            )}
          >
            Choose a workout
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/workouts"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-14 justify-start gap-3 rounded-2xl px-5 text-base',
          )}
        >
          <Library className="size-5 text-muted-foreground" />
          Library
        </Link>
        <Link
          href="/history"
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-14 justify-start gap-3 rounded-2xl px-5 text-base',
          )}
        >
          <History className="size-5 text-muted-foreground" />
          History
        </Link>
      </div>
    </div>
  );
}
