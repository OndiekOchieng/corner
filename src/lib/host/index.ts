/**
 * Runtime Host Adapter — public surface (PR-004a).
 *
 * Adapts the browser runtime to the platform-agnostic Execution Engine.
 * Browser concerns (performance.now, requestAnimationFrame, visibilitychange)
 * live here and NEVER leak into `src/lib/engine`.
 *
 *   Browser Runtime → Host Adapter → Execution Engine
 */

export { BrowserClock } from './HostClock';
export { RuntimeLoop, RafScheduler, type FrameScheduler } from './RuntimeLoop';
export {
  VisibilityObserver,
  BrowserVisibilitySource,
  type VisibilitySource,
  type VisibilityHandlers,
} from './VisibilityObserver';
export { EngineController, type EngineControllerDeps } from './EngineController';
export { createHostRuntime, type HostRuntime, type HostRuntimeDeps } from './HostRuntime';
