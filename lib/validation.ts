import { Workout, Round, CoachingCue } from '@/types/workout';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCoachingCue(cue: CoachingCue): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!cue.text || cue.text.trim().length === 0) {
    errors.push({ field: 'text', message: 'Coaching cue text is required' });
  }

  if (cue.text && cue.text.length > 200) {
    errors.push({
      field: 'text',
      message: 'Coaching cue text must be 200 characters or less',
    });
  }

  if (cue.timeSeconds !== undefined) {
    if (cue.timeSeconds < 0 || cue.timeSeconds > 3600) {
      errors.push({
        field: 'timeSeconds',
        message: 'Time must be between 0 and 3600 seconds',
      });
    }
  }

  return errors;
}

export function validateRound(round: Round, roundDuration: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!round.name || round.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Round name is required' });
  }

  if (round.drillDuration <= 0) {
    errors.push({
      field: 'drillDuration',
      message: 'Drill duration must be greater than 0',
    });
  }

  if (round.restDuration < 0) {
    errors.push({
      field: 'restDuration',
      message: 'Rest duration cannot be negative',
    });
  }

  if (round.coachingCues.length === 0) {
    errors.push({
      field: 'coachingCues',
      message: 'Round must have at least one coaching cue',
    });
  }

  round.coachingCues.forEach((cue, index) => {
    const cueErrors = validateCoachingCue(cue);
    if (cueErrors.length > 0) {
      errors.push(...cueErrors.map((e) => ({ ...e, field: `cue_${index}_${e.field}` })));
    }
  });

  return errors;
}

export function validateWorkout(workout: Workout): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!workout.name || workout.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Workout name is required' });
  }

  if (workout.name && workout.name.length > 100) {
    errors.push({
      field: 'name',
      message: 'Workout name must be 100 characters or less',
    });
  }

  if (!workout.description || workout.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  if (workout.description && workout.description.length > 500) {
    errors.push({
      field: 'description',
      message: 'Description must be 500 characters or less',
    });
  }

  if (workout.roundDuration <= 0) {
    errors.push({
      field: 'roundDuration',
      message: 'Round duration must be greater than 0',
    });
  }

  if (workout.restDuration < 0) {
    errors.push({
      field: 'restDuration',
      message: 'Rest duration cannot be negative',
    });
  }

  if (workout.roundCount <= 0) {
    errors.push({
      field: 'roundCount',
      message: 'Must have at least 1 round',
    });
  }

  if (workout.roundCount > 50) {
    errors.push({
      field: 'roundCount',
      message: 'Cannot have more than 50 rounds',
    });
  }

  if (workout.rounds.length === 0) {
    errors.push({
      field: 'rounds',
      message: 'Workout must have at least one round',
    });
  }

  workout.rounds.forEach((round, index) => {
    const roundErrors = validateRound(round, workout.roundDuration);
    if (roundErrors.length > 0) {
      errors.push(
        ...roundErrors.map((e) => ({ ...e, field: `round_${index}_${e.field}` }))
      );
    }
  });

  return errors;
}

export function isValidWorkout(workout: Workout): boolean {
  return validateWorkout(workout).length === 0;
}

export function getValidationErrorMessage(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  return errors.map((e) => e.message).join('; ');
}
