/**
 * Audio Bell Generator
 * Creates bell sounds using Web Audio API for round transitions
 */

class AudioBellGenerator {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a bell sound using oscillator
   * @param frequency - Frequency in Hz (default 800)
   * @param duration - Duration in seconds (default 0.5)
   * @param volume - Volume 0-1 (default 0.3)
   */
  playBell(frequency: number = 800, duration: number = 0.5, volume: number = 0.3): void {
    if (!this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      const endTime = now + duration;

      // Create oscillator
      const osc = this.audioContext.createOscillator();
      osc.frequency.value = frequency;
      osc.type = 'sine';

      // Create gain node for volume and envelope
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

      // Connect and play
      osc.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(endTime);
    } catch (error) {
      console.error('[v0] Audio bell error:', error);
    }
  }

  /**
   * Play round start bell (two quick beeps)
   */
  playRoundStart(): void {
    this.playBell(850, 0.2, 0.4);
    setTimeout(() => {
      this.playBell(850, 0.2, 0.4);
    }, 250);
  }

  /**
   * Play rest start bell (single long beep)
   */
  playRestStart(): void {
    this.playBell(600, 0.4, 0.3);
  }

  /**
   * Play finish bell (three ascending beeps)
   */
  playFinish(): void {
    this.playBell(600, 0.2, 0.4);
    setTimeout(() => {
      this.playBell(700, 0.2, 0.4);
    }, 250);
    setTimeout(() => {
      this.playBell(800, 0.3, 0.4);
    }, 500);
  }

  /**
   * Play warning bell (beep at 10 seconds remaining)
   */
  playWarning(): void {
    this.playBell(1000, 0.15, 0.3);
  }
}

// Singleton instance
let bellGenerator: AudioBellGenerator | null = null;

export function getBellGenerator(): AudioBellGenerator {
  if (!bellGenerator) {
    bellGenerator = new AudioBellGenerator();
  }
  return bellGenerator;
}

export function playRoundStartBell(): void {
  getBellGenerator().playRoundStart();
}

export function playRestStartBell(): void {
  getBellGenerator().playRestStart();
}

export function playFinishBell(): void {
  getBellGenerator().playFinish();
}

export function playWarningBell(): void {
  getBellGenerator().playWarning();
}
