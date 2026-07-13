import { describe, it, expect } from 'vitest';
import { BrowserClock } from '../../lib/host';
import { FakeClock } from '../../lib/engine';

describe('BrowserClock', () => {
  it('reads from its injected time source', () => {
    let t = 100;
    const clock = new BrowserClock(() => t);
    expect(clock.now()).toBe(100);
    t = 250;
    expect(clock.now()).toBe(250);
  });

  it('is compatible with the engine FakeClock', () => {
    const fake = new FakeClock(0);
    const clock = new BrowserClock(() => fake.now());
    fake.advance(500);
    expect(clock.now()).toBe(500);
    fake.set(1234);
    expect(clock.now()).toBe(1234);
  });

  it('default source returns a monotonic number (no browser required)', () => {
    const clock = new BrowserClock();
    const a = clock.now();
    const b = clock.now();
    expect(typeof a).toBe('number');
    expect(b).toBeGreaterThanOrEqual(a);
  });
});
