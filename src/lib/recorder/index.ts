/**
 * Flight Recorder — the workout remembers (PR-032).
 *
 * A single parasitic observer that turns the event stream into the honest story of
 * a workout. It owns nothing; it merely remembers. See `FlightRecorder`.
 */

export {
  FlightRecorder,
  FLIGHT_RECORDER_SUBSCRIBER_ID,
  type StoryMoment,
  type StoryKind,
} from './FlightRecorder';

export {
  summarizeWorkout,
  buildDevWorkoutStory,
  captureDevWorkoutStory,
  getDevWorkoutStory,
  type DevStoryVerdict,
  type DevWorkoutStory,
  type DevStoryInputs,
} from './DeveloperWorkoutStory';
