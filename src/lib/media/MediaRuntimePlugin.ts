/**
 * MediaRuntimePlugin — the Media Runtime as an Event Runtime subscriber.
 *
 * Registered on the same EventBus as the Coach Runtime, it drives browser media
 * off the workout lifecycle: acquire the wake lock + resume audio on start, ring
 * the transition bells, and release the wake lock on finish/cancel. It forwards
 * every relevant event to the MediaRuntime, which owns the actual browser calls.
 *
 * It runs after the Coach Runtime (lower priority) so coaching speech is enqueued
 * first; bells and lifecycle follow.
 */

import type { Subscriber } from '../runtime';
import type { WorkoutEvent } from '../engine';
import type { MediaRuntime } from './MediaRuntime';

export const MEDIA_RUNTIME_SUBSCRIBER_ID = 'media-runtime';

export class MediaRuntimePlugin implements Subscriber {
  readonly id = MEDIA_RUNTIME_SUBSCRIBER_ID;
  readonly priority: number;

  constructor(
    private readonly media: MediaRuntime,
    priority = 40,
  ) {
    this.priority = priority;
  }

  canHandle(event: WorkoutEvent): boolean {
    switch (event.type) {
      case 'WORKOUT_STARTED':
      case 'ROUND_STARTED':
      case 'REST_STARTED':
      case 'WORKOUT_COMPLETED':
      case 'WORKOUT_CANCELLED':
        return true;
      default:
        return false;
    }
  }

  handle(event: WorkoutEvent): void {
    this.media.onEvent(event);
  }
}

export function createMediaRuntimePlugin(media: MediaRuntime, priority = 40): MediaRuntimePlugin {
  return new MediaRuntimePlugin(media, priority);
}
