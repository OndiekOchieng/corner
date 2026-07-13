/**
 * Execution Engine — public surface (PR-003).
 *
 * Pure domain only: no React, no DOM, no browser APIs. Runs under Node.
 * External code communicates through commands (in) and events (out).
 */

// Time
export { type Clock, SystemClock, FakeClock } from './Clock';

// Commands (in)
export {
  type Command,
  type CommandType,
  startWorkout,
  pauseWorkout,
  resumeWorkout,
  cancelWorkout,
  advanceTime,
} from './Commands';

// Events (out)
export type {
  WorkoutEvent,
  WorkoutEventType,
  WorkoutStartedData,
  WarmupStartedData,
  WarmupCompletedData,
  RoundStartedData,
  RoundCompletedData,
  RestStartedData,
  RestCompletedData,
  CountdownStartedData,
  CountdownSecondData,
  CoachCueData,
  WorkoutPausedData,
  WorkoutResumedData,
  WorkoutCompletedData,
  WorkoutCancelledData,
} from './Events';

// State
export {
  type Phase,
  type Status,
  type ExecutionState,
  type WorkoutSnapshot,
  createInitialExecutionState,
  deriveSnapshot,
} from './State';

// Session
export {
  SESSION_SCHEMA_VERSION,
  type SessionStatus,
  type WorkoutSession,
  type SessionSnapshot,
  createSession,
} from './WorkoutSession';

// Timeline / Segment / Marker
export {
  Timeline,
  buildTimeline,
  TimelineError,
  type ScheduleEntry,
  type BoundaryEntry,
  type EnteringSpec,
} from './Timeline';
export { type Segment, type SegmentKind, segmentDurationMs } from './Segment';
export {
  type Marker,
  type CountdownContext,
  type CountdownStartMarker,
  type CountdownSecondMarker,
  type CueMarker,
  DEFAULT_COUNTDOWN_LEAD_SECONDS,
  DEFAULT_STALE_THRESHOLD_MS,
} from './Marker';

// Reducer (pure)
export { reduce, type ReducerContext, type ReduceResult } from './Reducer';

// Engine (shell)
export { Engine, type EngineOptions } from './Engine';

// Config types
export {
  type WorkoutConfig,
  type RoundConfig,
  type CueConfig,
  WORKOUT_CONFIG_SCHEMA_VERSION,
} from '../../types/workout-config';
