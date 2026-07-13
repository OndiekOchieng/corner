/**
 * Integration layer — Corner-specific wiring that bridges the generic runtime to
 * the app's subsystems. Kept OUT of `src/lib/runtime` so that package stays
 * reusable and app-agnostic (PR-004d / Platform Stability Review F4).
 *
 * The event-shaped `Coach` port and `CoachSubscriber` are generic and remain in
 * `runtime`; they are re-exported here for convenient one-stop app wiring.
 */

export { CoachEngineAdapter } from './CoachEngineAdapter';
export { CoachSubscriber, COACH_SUBSCRIBER_ID, type Coach, type CoachSubscriberOptions } from '../runtime';

// Live-app wiring: map the app workout into engine config. (Transition bells and
// all other browser media now live in the Media Runtime — src/lib/media.)
export { toWorkoutConfig } from './workout-config';
