import { useState, useCallback } from 'react';

export interface TimerState {
  isActive: boolean;
  isPaused: boolean;
  totalSeconds: number;
  elapsedSeconds: number;
}

/**
 * Timer state management hook.
 * NOTE: This hook manages UI state only and does not execute countdown logic.
 * Countdown execution will be implemented in Phase 2+.
 */
export function useTimer(initialDuration: number) {
  const [state, setState] = useState<TimerState>({
    isActive: false,
    isPaused: false,
    totalSeconds: initialDuration,
    elapsedSeconds: 0,
  });

  const start = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: true,
      isPaused: false,
    }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPaused: true,
    }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPaused: false,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isActive: false,
      isPaused: false,
      totalSeconds: initialDuration,
      elapsedSeconds: 0,
    });
  }, [initialDuration]);

  const setElapsedSeconds = useCallback((seconds: number) => {
    setState((prev) => ({
      ...prev,
      elapsedSeconds: Math.min(seconds, prev.totalSeconds),
    }));
  }, []);

  return {
    ...state,
    start,
    pause,
    resume,
    reset,
    setElapsedSeconds,
    remainingSeconds: state.totalSeconds - state.elapsedSeconds,
  };
}
