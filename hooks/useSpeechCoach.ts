'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechService } from '@/lib/speech/SpeechService';
import { CoachEngine } from '@/lib/speech/CoachEngine';

export interface UseSpeechCoachOptions {
  /** Master on/off (maps to the "Coaching Cues" preference). */
  enabled?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string | null;
}

export interface UseSpeechCoachReturn {
  /**
   * The CoachEngine — the ONLY speech-facing object components should call.
   * `null` during SSR / before the client mounts.
   */
  coach: CoachEngine | null;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

/**
 * React adapter for the voice-coaching stack.
 *
 * Owns a single SpeechService + CoachEngine per mount, keeps them in sync with
 * the user's persisted voice settings, and surfaces the CoachEngine plus a
 * little reactive state (support flag + available voices) to the UI.
 *
 * Components talk to `coach` (CoachEngine); they never see the SpeechService or
 * the browser Speech API.
 */
export function useSpeechCoach(
  options: UseSpeechCoachOptions = {}
): UseSpeechCoachReturn {
  const { enabled = true, rate = 1, pitch = 1, volume = 1, voiceURI = null } =
    options;

  const serviceRef = useRef<SpeechService | null>(null);
  const coachRef = useRef<CoachEngine | null>(null);

  // Lazily construct once, on the client only.
  if (serviceRef.current === null && typeof window !== 'undefined') {
    serviceRef.current = new SpeechService({ enabled, rate, pitch, volume });
    coachRef.current = new CoachEngine(serviceRef.current);
  }

  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Detect support + subscribe to (async) voice loading.
  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;
    setIsSupported(service.isSupported());
    setVoices(service.getVoices());
    const unsubscribe = service.onVoicesChanged(setVoices);
    return unsubscribe;
  }, []);

  // Keep the service in sync with settings.
  useEffect(() => {
    serviceRef.current?.setEnabled(enabled);
  }, [enabled]);
  useEffect(() => {
    serviceRef.current?.setRate(rate);
  }, [rate]);
  useEffect(() => {
    serviceRef.current?.setPitch(pitch);
  }, [pitch]);
  useEffect(() => {
    serviceRef.current?.setVolume(volume);
  }, [volume]);
  useEffect(() => {
    serviceRef.current?.setVoice(voiceURI);
    // Re-resolve when the voice list arrives after the preference is known.
  }, [voiceURI, voices]);

  // Stop any in-flight speech when the consumer unmounts.
  useEffect(() => {
    return () => serviceRef.current?.cancel();
  }, []);

  const pause = useCallback(() => serviceRef.current?.pause(), []);
  const resume = useCallback(() => serviceRef.current?.resume(), []);
  const cancel = useCallback(() => serviceRef.current?.cancel(), []);

  return {
    coach: coachRef.current,
    isSupported,
    voices,
    pause,
    resume,
    cancel,
  };
}
