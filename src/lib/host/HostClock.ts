/**
 * BrowserClock — a production `Clock` for the browser runtime.
 *
 * Satisfies the engine's existing `Clock` interface (`src/lib/engine/Clock.ts`)
 * and is the ONLY host component that reads wall time. It uses
 * `performance.now()` (monotonic, page-relative), which is the correct source of
 * truth for elapsed time. Note: `requestAnimationFrame` is used elsewhere only
 * to decide *when* to tick — never as the time value itself.
 *
 * The underlying time source is injectable so the host is testable in Node
 * without a browser (and so a `FakeClock` can be adapted trivially).
 */

import type { Clock } from '../engine';
import { systemNow } from '../platform/time';

export class BrowserClock implements Clock {
  private readonly source: () => number;

  constructor(source: () => number = systemNow) {
    this.source = source;
  }

  now(): number {
    return this.source();
  }
}
