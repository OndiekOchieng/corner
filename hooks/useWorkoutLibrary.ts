'use client';

import { useCallback, useMemo } from 'react';
import { Workout, CustomWorkout } from '@/types/workout';
import { useWorkout } from './useWorkout';
import { useCustomWorkouts } from './useCustomWorkouts';

export function useWorkoutLibrary() {
  const { workouts: seededWorkouts } = useWorkout();
  const { customWorkouts } = useCustomWorkouts();

  // Combine seeded and custom workouts
  const allWorkouts = useMemo<(Workout | CustomWorkout)[]>(() => {
    return [...seededWorkouts, ...customWorkouts];
  }, [seededWorkouts, customWorkouts]);

  const getWorkoutById = useCallback(
    (id: string) => {
      return allWorkouts.find((w) => w.id === id);
    },
    [allWorkouts]
  );

  const getWorkoutsByDifficulty = useCallback(
    (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
      return allWorkouts.filter((w) => w.difficulty === difficulty);
    },
    [allWorkouts]
  );

  const getWorkoutsByStance = useCallback(
    (stance: 'orthodox' | 'southpaw' | 'both') => {
      return allWorkouts.filter((w) => w.stance === stance);
    },
    [allWorkouts]
  );

  const searchWorkouts = useCallback(
    (query: string) => {
      const lowerQuery = query.toLowerCase();
      return allWorkouts.filter(
        (w) =>
          w.name.toLowerCase().includes(lowerQuery) ||
          w.description.toLowerCase().includes(lowerQuery)
      );
    },
    [allWorkouts]
  );

  return {
    allWorkouts,
    seededWorkouts,
    customWorkouts,
    getWorkoutById,
    getWorkoutsByDifficulty,
    getWorkoutsByStance,
    searchWorkouts,
  };
}
