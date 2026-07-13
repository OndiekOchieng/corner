'use client';

import { useCallback } from 'react';
import { UserPreferences } from '@/types/workout';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_PREFERENCES: UserPreferences = {
  speechEnabled: true,
  bellsEnabled: true,
  voiceRate: 1.2,
  voicePitch: 1,
  volume: 0.8,
  voiceURI: null,
  coachPack: 'fightnight',
  theme: 'dark',
  restWarning: 10,
};

export function usePreferences() {
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    'userPreferences',
    DEFAULT_PREFERENCES
  );

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
