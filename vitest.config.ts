import { defineConfig } from 'vitest/config';

// The speech stack (SpeechService, CoachEngine, phrases) is framework-free, so
// tests run in a plain Node environment with a mocked SpeechSynthesis — never a
// real browser or real voices.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});
