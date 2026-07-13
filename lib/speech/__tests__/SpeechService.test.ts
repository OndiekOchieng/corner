import { describe, it, expect, beforeEach } from 'vitest';
import { SpeechService } from '@/lib/speech/SpeechService';
import { MockSpeechSynthesis, createMockUtterance } from './mockSpeechSynthesis';

function makeService(synth: MockSpeechSynthesis) {
  return new SpeechService({ synth, createUtterance: createMockUtterance });
}

describe('SpeechService', () => {
  let synth: MockSpeechSynthesis;
  let service: SpeechService;

  beforeEach(() => {
    synth = new MockSpeechSynthesis();
    service = makeService(synth);
  });

  describe('support detection', () => {
    it('is supported when a synth and utterance factory are provided', () => {
      expect(service.isSupported()).toBe(true);
    });

    it('is unsupported when no synth is available', () => {
      const unsupported = new SpeechService({ synth: null });
      expect(unsupported.isSupported()).toBe(false);
      // speaking is a safe no-op when unsupported
      expect(() => unsupported.speak('hello')).not.toThrow();
    });
  });

  describe('queue ordering', () => {
    it('plays utterances strictly in order, one at a time', () => {
      service.speak('a');
      service.speak('b');
      service.speak('c');

      // Only the first utterance starts immediately (no overlap).
      expect(synth.started).toEqual(['a']);
      expect(service.isSpeaking()).toBe(true);

      synth.drain();
      expect(synth.started).toEqual(['a', 'b', 'c']);
      expect(synth.ended).toEqual(['a', 'b', 'c']);
      expect(service.isSpeaking()).toBe(false);
    });

    it('never overlaps: a second speak() does not start until the first ends', () => {
      service.speak('first');
      service.speak('second');
      expect(synth.started).toEqual(['first']);

      synth.finishCurrent();
      expect(synth.started).toEqual(['first', 'second']);
    });

    it('ignores empty / whitespace-only text', () => {
      service.speak('');
      service.speak('   ');
      expect(synth.started).toEqual([]);
      expect(service.pendingCount).toBe(0);
    });

    it('continues the queue even if an utterance errors', () => {
      service.speak('a');
      service.speak('b');
      // Simulate an error on the current utterance instead of a normal end.
      synth.current?.onerror?.();
      expect(synth.started).toEqual(['a', 'b']);
    });
  });

  describe('pause / resume', () => {
    it('holds the queue while paused and resumes in order', () => {
      service.speak('a');
      service.speak('b');
      expect(synth.started).toEqual(['a']);

      service.pause();
      expect(synth.paused).toBe(true);

      // Finishing the current utterance must NOT start the next while paused.
      synth.finishCurrent();
      expect(synth.started).toEqual(['a']);

      service.resume();
      expect(synth.paused).toBe(false);
      expect(synth.started).toEqual(['a', 'b']);
    });
  });

  describe('cancel', () => {
    it('drops the queue and stops speaking', () => {
      service.speak('a');
      service.speak('b');
      service.speak('c');

      service.cancel();
      expect(service.pendingCount).toBe(0);
      expect(service.isSpeaking()).toBe(false);

      // A fresh phrase works after cancel.
      service.speak('d');
      expect(synth.started).toEqual(['a', 'd']);
    });
  });

  describe('dispose — instance-local teardown (does NOT touch the shared global)', () => {
    it('leaves the shared synth engine running so another instance is unaffected', () => {
      service.speak('a');
      expect(synth.current?.text).toBe('a');
      expect(synth.speaking).toBe(true);

      service.dispose();

      // The global engine is untouched — an utterance owned elsewhere survives.
      // (This is the fix: React StrictMode's build→dispose→build no longer
      // cancels its own in-flight utterance before onstart.)
      expect(synth.current?.text).toBe('a');
      expect(synth.speaking).toBe(true);
      // …but THIS instance is neutralised: queue dropped, callbacks detached.
      expect(service.pendingCount).toBe(0);
      expect(service.isSpeaking()).toBe(false);
      expect(synth.current?.onend).toBeNull();
    });

    it('contrast: cancel() DOES cancel the shared engine', () => {
      service.speak('a');
      service.cancel();
      expect(synth.current).toBeNull();
      expect(synth.speaking).toBe(false);
    });
  });

  describe('clearQueue', () => {
    it('drops pending utterances but lets the current one finish', () => {
      service.speak('a');
      service.speak('b');
      service.speak('c');
      expect(synth.started).toEqual(['a']);

      service.clearQueue();
      expect(service.pendingCount).toBe(0);

      // 'a' is still in flight; finishing it does not start b/c.
      synth.finishCurrent();
      expect(synth.started).toEqual(['a']);
    });
  });

  describe('enabled flag', () => {
    it('does not speak when disabled', () => {
      service.setEnabled(false);
      service.speak('nope');
      expect(synth.started).toEqual([]);
    });

    it('cancels in-flight speech when disabled mid-utterance', () => {
      service.speak('a');
      service.speak('b');
      service.setEnabled(false);
      expect(service.pendingCount).toBe(0);
      expect(service.isSpeaking()).toBe(false);
    });
  });

  describe('warm (gesture priming — Chrome/iOS)', () => {
    it('clears a suspended synthesis queue', () => {
      synth.paused = true;
      service.warm();
      expect(synth.paused).toBe(false); // resumed
    });

    it('nudges resume after each utterance so Chrome does not go silent', () => {
      synth.paused = true; // simulate Chrome suspending the queue
      service.speak('a');
      expect(synth.started).toEqual(['a']);
      expect(synth.paused).toBe(false); // pump() called resume() after speak
    });
  });

  describe('pipeline trace (stats)', () => {
    it('counts speak() → synth.speak() → onstart → onend across the boundary', () => {
      service.speak('a');
      let s = service.stats();
      expect(s.instanceId).toBeGreaterThan(0);
      expect(s.speakCalls).toBe(1);
      expect(s.synthSpeakCalls).toBe(1);
      expect(s.started).toBe(1); // the (mock) browser fired onstart
      expect(s.ended).toBe(0);
      expect(s.errors).toBe(0);

      synth.finishCurrent(); // → onend
      s = service.stats();
      expect(s.ended).toBe(1);
    });

    it('counts a dropped speak() (disabled) but never reaches the browser', () => {
      service.setEnabled(false);
      service.speak('nope');
      const s = service.stats();
      expect(s.speakCalls).toBe(1);
      expect(s.synthSpeakCalls).toBe(0); // the break would be BEFORE the browser
    });

    it('records an utterance error', () => {
      service.speak('a');
      synth.current?.onerror?.({ error: 'interrupted' });
      expect(service.stats().errors).toBe(1);
    });
  });

  describe('utterance configuration', () => {
    it('applies rate, pitch, and volume to utterances', () => {
      service.setRate(1.5);
      service.setPitch(0.8);
      service.setVolume(0.5);
      service.speak('configured');

      expect(synth.current?.rate).toBe(1.5);
      expect(synth.current?.pitch).toBe(0.8);
      expect(synth.current?.volume).toBe(0.5);
    });
  });
});
