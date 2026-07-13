'use client';

import { useCallback } from 'react';
import { CustomWorkout, Workout } from '@/types/workout';
import { useLocalStorage } from './useLocalStorage';

export function useCustomWorkouts() {
  const [customWorkouts, setCustomWorkouts] = useLocalStorage<CustomWorkout[]>(
    'customWorkouts',
    []
  );

  const addCustomWorkout = useCallback(
    (workout: Omit<CustomWorkout, 'isCustom' | 'createdAt' | 'lastModified'>) => {
      const newWorkout: CustomWorkout = {
        ...(workout as any),
        isCustom: true,
        createdAt: new Date(),
        lastModified: new Date(),
      };
      setCustomWorkouts((prev) => [...prev, newWorkout]);
      return newWorkout;
    },
    [setCustomWorkouts]
  );

  const updateCustomWorkout = useCallback(
    (id: string, updates: Partial<CustomWorkout>) => {
      setCustomWorkouts((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                ...updates,
                lastModified: new Date(),
              }
            : w
        )
      );
    },
    [setCustomWorkouts]
  );

  const deleteCustomWorkout = useCallback(
    (id: string) => {
      setCustomWorkouts((prev) => prev.filter((w) => w.id !== id));
    },
    [setCustomWorkouts]
  );

  const getCustomWorkout = useCallback(
    (id: string) => {
      return customWorkouts.find((w) => w.id === id);
    },
    [customWorkouts]
  );

  return {
    customWorkouts,
    addCustomWorkout,
    updateCustomWorkout,
    deleteCustomWorkout,
    getCustomWorkout,
  };
}
