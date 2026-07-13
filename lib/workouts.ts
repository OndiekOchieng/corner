import { Workout } from '@/types/workout';
import { SEEDED_WORKOUTS } from '@/data/seeded-workouts';

export function getWorkouts(): Workout[] {
  return SEEDED_WORKOUTS;
}

export function getWorkoutById(id: string): Workout | undefined {
  return getWorkouts().find((w) => w.id === id);
}

export function getWorkoutsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Workout[] {
  return getWorkouts().filter((w) => w.difficulty === difficulty);
}

export function validateWorkout(workout: Workout): boolean {
  return !!(
    workout.id &&
    workout.name &&
    workout.rounds &&
    workout.rounds.length > 0 &&
    workout.roundCount > 0 &&
    workout.roundDuration > 0
  );
}
