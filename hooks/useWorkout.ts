import { useState, useCallback, useEffect } from 'react';
import { Workout, WorkoutSession } from '@/types/workout';
import { getWorkoutById, getWorkouts, validateWorkout } from '@/lib/workouts';

export function useWorkout() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const loadedWorkouts = getWorkouts();
      setWorkouts(loadedWorkouts);
      setError(null);
    } catch (err) {
      setError('Failed to load workouts');
      console.error('[v0] Workout loading error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectWorkout = useCallback((id: string) => {
    const workout = getWorkoutById(id);
    if (workout && validateWorkout(workout)) {
      setSelectedWorkout(workout);
      return true;
    }
    setError(`Workout with ID ${id} not found`);
    return false;
  }, []);

  const loadWorkoutById = useCallback((id: string) => {
    return getWorkoutById(id);
  }, []);

  return {
    workouts,
    selectedWorkout,
    loading,
    error,
    selectWorkout,
    loadWorkoutById,
  };
}
