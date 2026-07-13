/**
 * HostRuntime — the composition root that wires the browser primitives
 * (BrowserClock + RafScheduler + BrowserVisibilitySource) around the engine and
 * hands back an EngineController.
 *
 * This is where browser concerns are chosen; every dependency is injectable so
 * the whole runtime can be driven deterministically in tests. The engine stays
 * platform-agnostic — HostRuntime depends on the engine, never the reverse.
 */

import { Engine, type Clock } from '../engine';
import type { WorkoutConfig } from '../engine';
import { EventBus, type Subscriber } from '../runtime';
import { BrowserClock } from './HostClock';
import { RafScheduler, type FrameScheduler } from './RuntimeLoop';
import { BrowserVisibilitySource, type VisibilitySource } from './VisibilityObserver';
import { EngineController } from './EngineController';

export interface HostRuntimeDeps {
  readonly clock?: Clock;
  readonly scheduler?: FrameScheduler;
  readonly visibilitySource?: VisibilitySource;
  readonly idFactory?: () => string;
  readonly staleThresholdMs?: number;
  /** Provide an EventBus (else one is created). */
  readonly eventBus?: EventBus;
  /** Subscribers to register on the bus at startup. */
  readonly subscribers?: readonly Subscriber[];
}

export interface HostRuntime {
  readonly controller: EngineController;
  readonly engine: Engine;
  readonly eventBus: EventBus;
  dispose(): void;
}

export function createHostRuntime(config: WorkoutConfig, deps: HostRuntimeDeps = {}): HostRuntime {
  const clock = deps.clock ?? new BrowserClock();
  const scheduler = deps.scheduler ?? new RafScheduler();
  const visibilitySource = deps.visibilitySource ?? new BrowserVisibilitySource();
  const eventBus = deps.eventBus ?? new EventBus();

  for (const subscriber of deps.subscribers ?? []) {
    eventBus.register(subscriber);
  }

  const engine = new Engine(config, {
    clock,
    idFactory: deps.idFactory,
    staleThresholdMs: deps.staleThresholdMs,
  });

  // The runtime composes the event runtime: forward only each dispatch's new
  // events to the bus (never the historical log).
  const controller = new EngineController({
    engine,
    clock,
    scheduler,
    visibilitySource,
    onEvents: (events) => eventBus.publishAll(events),
  });

  return {
    controller,
    engine,
    eventBus,
    dispose: () => {
      controller.dispose();
      eventBus.clear();
    },
  };
}
