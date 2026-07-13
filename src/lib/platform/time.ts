/**
 * Shared time primitives for the runtime stack (host, event runtime, session).
 *
 * Extracted in PR-004d to remove four duplicated `defaultNow()` implementations
 * and a second `NowFn` definition. The Execution Engine intentionally keeps its
 * own richer `Clock` abstraction (it must remain standalone/dependency-free);
 * `NowFn` is the lightweight time function the non-engine layers already used.
 *
 * Behaviour is identical to the implementations it replaces: prefer the monotonic
 * `performance.now()`, falling back to `Date.now()` under Node/SSR.
 */

export type NowFn = () => number;

export function systemNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
