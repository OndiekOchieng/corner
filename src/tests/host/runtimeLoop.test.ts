import { describe, it, expect } from 'vitest';
import { RuntimeLoop } from '../../lib/host';
import { ManualFrameScheduler } from '../host-fakes';

describe('RuntimeLoop', () => {
  it('ticks once per frame and self-reschedules', () => {
    const scheduler = new ManualFrameScheduler();
    let frames = 0;
    const loop = new RuntimeLoop(scheduler, () => frames++);

    loop.start();
    expect(loop.isActive).toBe(true);
    expect(loop.isTicking).toBe(true);
    expect(scheduler.pending).toBe(1);

    scheduler.flushFrame();
    expect(frames).toBe(1);
    expect(scheduler.pending).toBe(1); // rescheduled

    scheduler.flushFrame();
    expect(frames).toBe(2);
  });

  it('pause stops ticking without ending the loop; resume continues', () => {
    const scheduler = new ManualFrameScheduler();
    let frames = 0;
    const loop = new RuntimeLoop(scheduler, () => frames++);

    loop.start();
    scheduler.flushFrame(); // frames = 1
    loop.pause();
    expect(loop.isTicking).toBe(false);
    expect(loop.isActive).toBe(true);
    expect(scheduler.pending).toBe(0);

    scheduler.flushFrame(); // nothing scheduled
    expect(frames).toBe(1);

    loop.resume();
    expect(scheduler.pending).toBe(1);
    scheduler.flushFrame();
    expect(frames).toBe(2);
  });

  it('stop tears the loop down', () => {
    const scheduler = new ManualFrameScheduler();
    let frames = 0;
    const loop = new RuntimeLoop(scheduler, () => frames++);

    loop.start();
    loop.stop();
    expect(loop.isActive).toBe(false);
    expect(scheduler.pending).toBe(0);
    scheduler.flushFrame();
    expect(frames).toBe(0);
  });

  it('start is idempotent and resume is a no-op while ticking', () => {
    const scheduler = new ManualFrameScheduler();
    const loop = new RuntimeLoop(scheduler, () => {});
    loop.start();
    loop.start();
    loop.resume();
    expect(scheduler.pending).toBe(1); // never double-schedules
  });

  it('contains no workout logic — it only invokes the callback', () => {
    const scheduler = new ManualFrameScheduler();
    const seen: string[] = [];
    const loop = new RuntimeLoop(scheduler, () => seen.push('frame'));
    loop.start();
    scheduler.flushFrame();
    scheduler.flushFrame();
    expect(seen).toEqual(['frame', 'frame']);
  });
});
