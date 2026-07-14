/**
 * A controllable, deterministic fake of the browser SpeechSynthesis API for
 * tests. It never touches a real browser or real voices.
 *
 * Unlike the real API, it does NOT auto-complete utterances — a test drives
 * completion explicitly via `finishCurrent()` / `drain()`. This gives precise
 * control over queue ordering, pause/resume, and cancellation.
 */
import type {
  SpeechSynthesisLike,
  UtteranceLike,
} from '@/lib/speech/SpeechService';

export function createMockUtterance(text: string): UtteranceLike {
  return {
    text,
    rate: 1,
    pitch: 1,
    volume: 1,
    voice: null,
    onstart: null,
    onend: null,
    onerror: null,
  };
}

export class MockSpeechSynthesis implements SpeechSynthesisLike {
  speaking = false;
  paused = false;
  onvoiceschanged: ((this: unknown, ev: Event) => unknown) | null = null;

  current: UtteranceLike | null = null;

  /** Ordered log of every utterance handed to the engine (by `onstart`). */
  started: string[] = [];
  /** Ordered log of every utterance that completed. */
  ended: string[] = [];

  private voices: SpeechSynthesisVoice[];

  constructor(voices: SpeechSynthesisVoice[] = []) {
    this.voices = voices;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(utterance: UtteranceLike): void {
    // The SpeechService only calls speak() when idle, so we can assume no
    // overlap here — mirror that by tracking a single "current" utterance.
    this.current = utterance;
    this.speaking = true;
    this.started.push(utterance.text);
    utterance.onstart?.();
  }

  /** Complete the current utterance, triggering the queue to advance. */
  finishCurrent(): void {
    const utterance = this.current;
    if (!utterance) return;
    this.current = null;
    this.speaking = false;
    this.ended.push(utterance.text);
    utterance.onend?.();
  }

  /** Complete everything currently queued, in order. */
  drain(): void {
    let guard = 0;
    while (this.current && guard++ < 1000) {
      this.finishCurrent();
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  cancel(): void {
    this.current = null;
    this.speaking = false;
    this.paused = false;
  }

  /** Simulate the browser finishing async voice enumeration (fires `voiceschanged`). */
  emitVoicesChanged(voices: SpeechSynthesisVoice[]): void {
    this.voices = voices;
    this.onvoiceschanged?.call(this, undefined as unknown as Event);
  }
}
