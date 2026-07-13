/**
 * Coach Runtime — public surface (PR-009).
 *
 * Transforms immutable engine events into intentional coaching behaviour, then
 * hands resolved lines to the existing SpeechService via the `SpeechSink` port.
 * It decides whether to speak, what to say, and when — it does not decide,
 * execute, or synthesize.
 *
 *   Execution Engine → Event Runtime → Coach Runtime → Speech Service
 *
 * Wiring: `bus.register(createCoachRuntimePlugin({ personality, sink: speechServiceSink(speechService) }))`.
 */

export {
  type CoachIntent,
  type CoachPackId,
  type CoachEnergy,
  type CoachAction,
  type SpeechSink,
  INTENT_PRIORITY,
  isStructural,
  isCritical,
  isRepeatable,
  basePriority,
} from './CoachAction';

export {
  type CoachConfig,
  type CoachContext,
  DEFAULT_COACH_CONFIG,
  makeContext,
} from './CoachContext';

export { ConversationState, type ConversationSnapshot } from './ConversationState';
export { CoachDirector, classifyCue, type DirectedIntent } from './CoachDirector';
export { SpeechPlanner, type PlanParams } from './SpeechPlanner';
export { decideSilence, type SilenceDecision } from './SilenceController';
export { priorityFor, shouldInterrupt, compare } from './PriorityResolver';
export { CoachActionQueue } from './CoachActionQueue';
export { QueueManager, type DrainResult } from './QueueManager';
export { CoachDiagnostics, type CoachDiagnosticsSnapshot } from './CoachDiagnostics';
export { CoachRuntime } from './CoachRuntime';

export {
  PERSONALITIES,
  personalityFor,
  type PersonalityProfile,
  type ComposedKey,
} from './personalities';

export {
  ANCHOR_BANKS,
  ANCHOR_IDS,
  anchorBank,
  parseAnchorKind,
  isAnchorId,
  type AnchorKind,
} from './anchors';

export {
  REINFORCEMENTS,
  reinforcementBank,
  classifyDimension,
  type Dimension,
} from './reinforcements';

export {
  CoachRuntimePlugin,
  createCoachRuntimePlugin,
  speechServiceSink,
  COACH_RUNTIME_SUBSCRIBER_ID,
  type CoachRuntimePluginOptions,
  type SpeechServiceLike,
} from './CoachRuntimePlugin';
