/**
 * LoggerSubscriber — a development logger. Subscribes to EVERY event and emits
 * structured log entries through an injected `LogSink`. This is the ONLY place
 * the runtime performs logging (no scattered `console.log`), and it is removable
 * (unregister by id).
 */

import type { Subscriber } from '../Subscriber';
import type { WorkoutEvent } from '../types';

export interface LogEntry {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly eventType: string;
  readonly eventSeq: number;
  readonly elapsedMs: number;
  readonly data: unknown;
}

export interface LogSink {
  log(entry: LogEntry): void;
}

/** Default sink: structured single-line output via console (the one sanctioned console use). */
export class ConsoleLogSink implements LogSink {
  log(entry: LogEntry): void {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log(`[runtime] #${entry.eventSeq} ${entry.eventType} @${entry.elapsedMs}ms`, entry.data);
    }
  }
}

/** Captures entries in memory — useful for tests and in-app diagnostics panels. */
export class MemoryLogSink implements LogSink {
  readonly entries: LogEntry[] = [];
  log(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

export const LOGGER_SUBSCRIBER_ID = 'logger';

export class LoggerSubscriber implements Subscriber {
  readonly id = LOGGER_SUBSCRIBER_ID;
  readonly priority: number;
  private readonly sink: LogSink;

  /** Loggers run last by default (low priority) so they observe after real handlers. */
  constructor(sink: LogSink = new ConsoleLogSink(), priority = -1000) {
    this.sink = sink;
    this.priority = priority;
  }

  canHandle(): boolean {
    return true; // log everything
  }

  handle(event: WorkoutEvent): void {
    this.sink.log({
      level: 'info',
      message: `event ${event.type}`,
      eventType: event.type,
      eventSeq: event.seq,
      elapsedMs: event.elapsedMs,
      data: event.data,
    });
  }
}
