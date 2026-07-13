'use client';

import { useCallback, useState } from 'react';
import { Workout, Round, CoachingCue } from '@/types/workout';
import { validateWorkout, ValidationError } from '@/lib/validation';
import { v4 as uuidv4 } from 'crypto';

export type BuilderStep = 'basic' | 'description' | 'warmup' | 'rounds' | 'cues' | 'review';

const createEmptyRound = (): Round => ({
  id: `round-${uuidv4()}`,
  name: '',
  drillDuration: 180,
  restDuration: 60,
  currentDrill: '',
  currentCue: { id: `cue-${uuidv4()}`, text: '' },
  coachingCues: [{ id: `cue-${uuidv4()}`, text: '' }],
});

const createEmptyWorkout = (): Workout => ({
  id: `workout-${uuidv4()}`,
  name: '',
  description: '',
  stance: 'orthodox',
  totalDuration: 0,
  roundDuration: 180,
  restDuration: 60,
  roundCount: 3,
  rounds: [createEmptyRound(), createEmptyRound(), createEmptyRound()],
  difficulty: 'intermediate',
});

export function useWorkoutBuilder(initialWorkout?: Workout) {
  const [workout, setWorkout] = useState<Workout>(
    initialWorkout || createEmptyWorkout()
  );
  const [currentStep, setCurrentStep] = useState<BuilderStep>('basic');
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const updateWorkout = useCallback(
    (updates: Partial<Workout>) => {
      setWorkout((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const updateRound = useCallback((roundId: string, updates: Partial<Round>) => {
    setWorkout((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) => (r.id === roundId ? { ...r, ...updates } : r)),
    }));
  }, []);

  const updateCoachingCue = useCallback(
    (roundId: string, cueId: string, text: string) => {
      setWorkout((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.id === roundId
            ? {
                ...r,
                coachingCues: r.coachingCues.map((c) =>
                  c.id === cueId ? { ...c, text } : c
                ),
              }
            : r
        ),
      }));
    },
    []
  );

  const addCoachingCue = useCallback((roundId: string) => {
    setWorkout((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) =>
        r.id === roundId
          ? {
              ...r,
              coachingCues: [...r.coachingCues, { id: `cue-${uuidv4()}`, text: '' }],
            }
          : r
      ),
    }));
  }, []);

  const removeCoachingCue = useCallback((roundId: string, cueId: string) => {
    setWorkout((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) =>
        r.id === roundId
          ? {
              ...r,
              coachingCues: r.coachingCues.filter((c) => c.id !== cueId),
            }
          : r
      ),
    }));
  }, []);

  const addRound = useCallback(() => {
    setWorkout((prev) => ({
      ...prev,
      rounds: [...prev.rounds, createEmptyRound()],
      roundCount: prev.roundCount + 1,
    }));
  }, []);

  const removeRound = useCallback((roundId: string) => {
    setWorkout((prev) => {
      if (prev.rounds.length === 1) return prev;
      return {
        ...prev,
        rounds: prev.rounds.filter((r) => r.id !== roundId),
        roundCount: Math.max(1, prev.roundCount - 1),
      };
    });
  }, []);

  const validateStep = useCallback((): boolean => {
    const stepErrors = validateWorkout(workout);
    setErrors(stepErrors);
    return stepErrors.length === 0;
  }, [workout]);

  const nextStep = useCallback(() => {
    if (validateStep()) {
      const steps: BuilderStep[] = ['basic', 'description', 'warmup', 'rounds', 'cues', 'review'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
      }
    }
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => {
    const steps: BuilderStep[] = ['basic', 'description', 'warmup', 'rounds', 'cues', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
      setErrors([]);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: BuilderStep) => {
    setCurrentStep(step);
    setErrors([]);
  }, []);

  const resetWorkout = useCallback(() => {
    setWorkout(createEmptyWorkout());
    setCurrentStep('basic');
    setErrors([]);
  }, []);

  return {
    workout,
    currentStep,
    errors,
    updateWorkout,
    updateRound,
    updateCoachingCue,
    addCoachingCue,
    removeCoachingCue,
    addRound,
    removeRound,
    validateStep,
    nextStep,
    prevStep,
    goToStep,
    resetWorkout,
  };
}
