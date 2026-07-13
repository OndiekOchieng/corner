/**
 * Commands — the inputs a consumer sends to the engine.
 *
 * `AdvanceTime` is the time input: it asks the engine to reconcile execution to
 * the current `Clock` reading. The other four are user-intent commands. All are
 * payload-free; the engine samples time from its injected `Clock` at dispatch.
 *
 * Commands validate their preconditions in the reducer (guards G1–G6); an
 * invalid command is a no-op and never corrupts state.
 *
 * NOTE (extension seam, ADR-0001 §9.A3): the deferred ADR-0002 would add
 * `Signal` and `Reshape` inputs here. They are intentionally absent — this
 * command set is the fixed-workout baseline.
 */

export type Command =
  | { readonly type: 'StartWorkout' }
  | { readonly type: 'PauseWorkout' }
  | { readonly type: 'ResumeWorkout' }
  | { readonly type: 'CancelWorkout' }
  | { readonly type: 'AdvanceTime' };

export type CommandType = Command['type'];

export const startWorkout = (): Command => ({ type: 'StartWorkout' });
export const pauseWorkout = (): Command => ({ type: 'PauseWorkout' });
export const resumeWorkout = (): Command => ({ type: 'ResumeWorkout' });
export const cancelWorkout = (): Command => ({ type: 'CancelWorkout' });
export const advanceTime = (): Command => ({ type: 'AdvanceTime' });
