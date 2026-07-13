/**
 * Event Runtime — public surface (PR-004b).
 *
 * The only event-delivery mechanism in the app. The Execution Engine emits
 * events; the Host Runtime publishes each dispatch's new events here; subscribers
 * react in deterministic priority order, isolated from one another.
 *
 *   Engine → Host Runtime → EventBus → Subscribers → done
 */

export { type Subscriber, DuplicateSubscriberError } from './Subscriber';
export { EventBus, type EventBusOptions } from './EventBus';
export { EventDispatcher } from './EventDispatcher';
export { SubscriberRegistry } from './SubscriberRegistry';
export { RuntimeDiagnostics } from './RuntimeDiagnostics';

export type {
  WorkoutEvent,
  NowFn,
  Delivery,
  DispatchReport,
  SubscriberFailure,
  SubscriberExecutionStat,
  RegisteredSubscriber,
  DiagnosticsSnapshot,
} from './types';

// Subscribers
export {
  CoachSubscriber,
  COACH_SUBSCRIBER_ID,
  type Coach,
  type CoachSubscriberOptions,
} from './subscribers/CoachSubscriber';
export { BellSubscriber, BELL_SUBSCRIBER_ID, type BellKind } from './subscribers/BellSubscriber';
export { StatsSubscriber, STATS_SUBSCRIBER_ID, type RuntimeStats } from './subscribers/StatsSubscriber';
export {
  LoggerSubscriber,
  LOGGER_SUBSCRIBER_ID,
  ConsoleLogSink,
  MemoryLogSink,
  type LogSink,
  type LogEntry,
} from './subscribers/LoggerSubscriber';
