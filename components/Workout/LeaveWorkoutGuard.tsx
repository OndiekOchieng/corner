'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface LeaveWorkoutGuardProps {
  /** True while a workout is being trained (guards are armed only then). */
  active: boolean;
  /** End the workout and leave — wired to the same quit flow as the End button. */
  onEndWorkout: () => void;
}

/**
 * LeaveWorkoutGuard — protects an active workout from accidental abandonment.
 *
 * The Active screen carries no navigation chrome, but the OS back gesture (Android
 * back, iOS swipe-back, browser back) and a refresh/close would still tear the
 * athlete out of training. This arms two guards while `active`:
 *
 *  - **beforeunload** — a native confirm on refresh / tab close.
 *  - **popstate** — intercepts back/swipe-back by re-seeding a history entry and
 *    asking in-app ("Leave workout?") instead of navigating away.
 *
 * "Continue Training" simply dismisses; "End Workout" runs the normal quit flow.
 * There is no visible back button — this only reacts to a real leave attempt.
 */
export function LeaveWorkoutGuard({ active, onEndWorkout }: LeaveWorkoutGuardProps) {
  const [asking, setAsking] = useState(false);
  const leavingRef = useRef(false);

  // Refresh / tab close → native browser confirmation.
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  // Browser/OS back (incl. iOS swipe-back, Android back) → in-app confirm.
  useEffect(() => {
    if (!active) return;
    // Seed a history entry so the first back stays within our control.
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      if (leavingRef.current) return; // a deliberate leave is in progress
      // Re-trap and ask instead of leaving.
      window.history.pushState(null, '', window.location.href);
      setAsking(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  const continueTraining = useCallback(() => setAsking(false), []);

  const endWorkout = useCallback(() => {
    leavingRef.current = true; // let the impending navigation through the guard
    setAsking(false);
    onEndWorkout();
  }, [onEndWorkout]);

  // Escape = the safe choice (keep training).
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') continueTraining();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking, continueTraining]);

  if (!asking) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm [padding-bottom:max(env(safe-area-inset-bottom),1.5rem)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-title"
      aria-describedby="leave-body"
    >
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 ring-1 ring-foreground/10 elevate-1">
        <h2 id="leave-title" className="text-2xl font-bold tracking-tight">
          Leave workout?
        </h2>
        <p id="leave-body" className="mt-2 text-muted-foreground">
          You&apos;re mid-session. Ending now won&apos;t be saved to your History.
        </p>
        <div className="mt-6 space-y-3">
          <Button autoFocus onClick={continueTraining} className="h-12 w-full text-base font-semibold">
            Continue training
          </Button>
          <Button
            variant="outline"
            onClick={endWorkout}
            className="h-12 w-full text-base font-semibold text-destructive"
          >
            End workout
          </Button>
        </div>
      </div>
    </div>
  );
}
