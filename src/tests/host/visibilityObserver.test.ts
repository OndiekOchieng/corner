import { describe, it, expect } from 'vitest';
import { VisibilityObserver } from '../../lib/host';
import { FakeVisibilitySource } from '../host-fakes';

describe('VisibilityObserver', () => {
  it('routes hidden/visible transitions to the right handlers', () => {
    const source = new FakeVisibilitySource();
    let hidden = 0;
    let visible = 0;
    const observer = new VisibilityObserver(source, {
      onHidden: () => hidden++,
      onVisible: () => visible++,
    });

    observer.start();
    expect(observer.isObserving).toBe(true);

    source.setHidden(true);
    expect(hidden).toBe(1);
    expect(visible).toBe(0);

    source.setHidden(false);
    expect(visible).toBe(1);
  });

  it('stops observing after stop()', () => {
    const source = new FakeVisibilitySource();
    let hidden = 0;
    const observer = new VisibilityObserver(source, { onHidden: () => hidden++, onVisible: () => {} });

    observer.start();
    observer.stop();
    expect(observer.isObserving).toBe(false);

    source.setHidden(true);
    expect(hidden).toBe(0); // no longer subscribed
  });

  it('start is idempotent', () => {
    const source = new FakeVisibilitySource();
    let hidden = 0;
    const observer = new VisibilityObserver(source, { onHidden: () => hidden++, onVisible: () => {} });
    observer.start();
    observer.start();
    source.setHidden(true);
    expect(hidden).toBe(1); // subscribed exactly once
  });
});
