/**
 * VisibilityObserver — bridges `document.visibilitychange` to two callbacks.
 *
 * The observer itself contains no reconciliation logic: on a change it simply
 * reports hidden vs visible. The EngineController decides what to do (record a
 * timestamp on hidden; reconcile elapsed time on visible). The engine only ever
 * receives elapsed time.
 *
 * The visibility source is abstracted so the host is testable in Node.
 * NOTE: this deliberately does NOT implement background execution or Wake Lock
 * (ADR-0003 territory).
 */

export interface VisibilitySource {
  isHidden(): boolean;
  /** Subscribe to visibility changes; returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}

/** Browser source backed by `document`. */
export class BrowserVisibilitySource implements VisibilitySource {
  isHidden(): boolean {
    return typeof document !== 'undefined' ? document.hidden : false;
  }

  subscribe(onChange: () => void): () => void {
    if (typeof document === 'undefined') return () => {};
    const handler = (): void => onChange();
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }
}

export interface VisibilityHandlers {
  onHidden: () => void;
  onVisible: () => void;
}

export class VisibilityObserver {
  private readonly source: VisibilitySource;
  private readonly handlers: VisibilityHandlers;
  private unsubscribe: (() => void) | null = null;

  constructor(source: VisibilitySource, handlers: VisibilityHandlers) {
    this.source = source;
    this.handlers = handlers;
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.source.subscribe(() => {
      if (this.source.isHidden()) this.handlers.onHidden();
      else this.handlers.onVisible();
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  get isObserving(): boolean {
    return this.unsubscribe !== null;
  }
}
