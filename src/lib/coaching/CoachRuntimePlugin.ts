/**
 * CoachRuntimePlugin — the Coach Runtime as an Event Runtime subscriber.
 *
 * This is the single integration seam: register it on the existing EventBus and
 * the coach comes alive. No Engine, Runtime, or Event Runtime changes are
 * required — it is a plain `Subscriber` like Bell/Stats/Logger.
 *
 *   Engine → Event Runtime → CoachRuntimePlugin → CoachRuntime → SpeechSink (SpeechService)
 *
 * The plugin owns no logic; it forwards every event to the CoachRuntime, which
 * decides. It runs early (priority 100) so coaching is enqueued promptly.
 */

import type { Subscriber } from '../runtime';
import type { WorkoutEvent } from '../engine';
import type { CoachPackId, SpeechSink } from './CoachAction';
import type { CoachConfig, SessionFacts } from './CoachContext';
import { makeContext } from './CoachContext';
import { CoachRuntime } from './CoachRuntime';
import type { CoachDiagnosticsSnapshot } from './CoachDiagnostics';

export const COACH_RUNTIME_SUBSCRIBER_ID = 'coach-runtime';

export interface CoachRuntimePluginOptions {
  readonly personality: CoachPackId;
  readonly sink: SpeechSink;
  readonly workoutName?: string;
  /** Session-introduction facts owned by the workout (PR-020B). */
  readonly facts?: SessionFacts;
  readonly config?: Partial<CoachConfig>;
  readonly priority?: number;
}

export class CoachRuntimePlugin implements Subscriber {
  readonly id = COACH_RUNTIME_SUBSCRIBER_ID;
  readonly priority: number;
  readonly runtime: CoachRuntime;

  constructor(runtime: CoachRuntime, priority = 100) {
    this.runtime = runtime;
    this.priority = priority;
  }

  /** The runtime is authoritative about relevance; let it see every event so its
   *  replay guard and elapsed tracking stay accurate. */
  canHandle(): boolean {
    return true;
  }

  handle(event: WorkoutEvent): void {
    this.runtime.onEvent(event);
  }

  diagnostics(): CoachDiagnosticsSnapshot {
    return this.runtime.diagnosticsSnapshot();
  }
}

export function createCoachRuntimePlugin(options: CoachRuntimePluginOptions): CoachRuntimePlugin {
  const context = makeContext(options.personality, {
    workoutName: options.workoutName,
    facts: options.facts,
    config: options.config,
  });
  const runtime = new CoachRuntime(context, options.sink);
  return new CoachRuntimePlugin(runtime, options.priority ?? 100);
}

/** Structural shape of the existing SpeechService (no import → no browser coupling). */
export interface SpeechServiceLike {
  speak(text: string): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  clearQueue(): void;
}

/**
 * Adapt the existing SpeechService to the `SpeechSink` port. The Coach Runtime
 * produces actions; the SpeechService renders them — it is neither rewritten nor
 * bypassed.
 */
export function speechServiceSink(service: SpeechServiceLike): SpeechSink {
  return {
    speak: (text) => service.speak(text),
    pause: () => service.pause(),
    resume: () => service.resume(),
    cancel: () => service.cancel(),
    clearPending: () => service.clearQueue(),
  };
}
