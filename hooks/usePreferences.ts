'use client';

import { useCallback, useEffect } from 'react';
import { UserPreferences } from '@/types/workout';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_PREFERENCES: UserPreferences = {
  speechEnabled: true,
  bellsEnabled: true,
  // Neutral: let the browser decide what 1.0 sounds like. Corner must not ship
  // faster than the platform's natural baseline (PR-024A).
  voiceRate: 1.0,
  voicePitch: 1,
  volume: 0.8,
  voiceURI: null,
  coachPack: 'fightnight',
};

/**
 * The historical shipped default. A stored value of exactly this is assumed to be
 * the old default (not a deliberate choice) and is normalised to 1.0 once.
 */
const LEGACY_DEFAULT_VOICE_RATE = 1.2;
const RATE_MIGRATION_FLAG = 'corner:prefs:rate-normalized-v1';
const PREFS_KEY = 'userPreferences';

export function usePreferences() {
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    PREFS_KEY,
    DEFAULT_PREFERENCES
  );

  // One-time migration (PR-024A): normalise the OLD shipped default (1.2) to the
  // new neutral 1.0 for existing users, without touching a rate the athlete
  // deliberately set to anything else. Guarded by a flag so it runs exactly once —
  // a later intentional choice of 1.2 is preserved. Reads the persisted value
  // directly (not React state) to avoid load-order races.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(RATE_MIGRATION_FLAG)) return;
    window.localStorage.setItem(RATE_MIGRATION_FLAG, '1');
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (!raw) return; // brand-new install already gets 1.0 from the defaults
      const stored = JSON.parse(raw) as Partial<UserPreferences>;
      if (stored?.voiceRate === LEGACY_DEFAULT_VOICE_RATE) {
        setPreferences((prev) => ({ ...prev, ...stored, voiceRate: 1.0 }));
      }
    } catch {
      /* corrupt storage: leave it to the normal read path */
    }
  }, [setPreferences]);

  const updatePreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...updates }));
    },
    [setPreferences]
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, [setPreferences]);

  const updateVoiceSettings = useCallback(
    (rate: number, pitch: number) => {
      setPreferences((prev) => ({
        ...prev,
        voiceRate: Math.min(Math.max(rate, 0.5), 2.0),
        voicePitch: Math.min(Math.max(pitch, 0.5), 2.0),
      }));
    },
    [setPreferences]
  );

  const toggleSpeech = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      speechEnabled: !prev.speechEnabled,
    }));
  }, [setPreferences]);

  const toggleBells = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      bellsEnabled: !prev.bellsEnabled,
    }));
  }, [setPreferences]);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    updateVoiceSettings,
    toggleSpeech,
    toggleBells,
  };
}
