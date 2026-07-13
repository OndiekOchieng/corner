'use client';

import { BackLink } from '@/components/ui/BackLink';
import { PageContainer } from '@/components/ui/PageContainer';
import { Button } from '@/components/ui/button';
import {
  SettingGroup,
  SettingRow,
  Toggle,
  SegmentedChoice,
} from '@/components/Settings/SettingsControls';
import { usePreferences } from '@/hooks/usePreferences';
import { useSpeechCoach } from '@/hooks';
import type { CoachPack } from '@/types/workout';

const COACHES: { id: CoachPack; name: string; blurb: string }[] = [
  { id: 'technical', name: 'Technical', blurb: 'Precise. Detail first.' },
  { id: 'oldschool', name: 'Old School', blurb: 'Blunt. Fundamentals.' },
  { id: 'fightnight', name: 'Fight Night', blurb: 'Big-fight energy.' },
  { id: 'calm', name: 'Calm', blurb: 'Steady and relaxed.' },
  { id: 'competition', name: 'Competition', blurb: 'A demanding standard.' },
  { id: 'southpaw', name: 'Southpaw', blurb: 'The left-hander’s game.' },
];

export default function SettingsPage() {
  const {
    preferences,
    toggleSpeech,
    toggleBells,
    updateVoiceSettings,
    updatePreferences,
    resetPreferences,
  } = usePreferences();

  const { voices, isSupported } = useSpeechCoach({
    enabled: preferences.speechEnabled,
    rate: preferences.voiceRate,
    pitch: preferences.voicePitch,
    volume: preferences.volume,
    voiceURI: preferences.voiceURI,
  });

  const sliderClass =
    'w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-[var(--push)]';

  return (
    <PageContainer>
      <BackLink href="/" label="Home" />

      <div className="mb-8 mt-6">
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Tune how the coach sounds and behaves.
        </p>
      </div>

      <div className="space-y-8">
        {/* --- Your coach --------------------------------------------------- */}
        <SettingGroup
          title="Your coach"
          description="Same workout, a different coach in your corner."
        >
          <div className="grid grid-cols-2 gap-2 p-4">
            {COACHES.map((coach) => {
              const selected = preferences.coachPack === coach.id;
              return (
                <button
                  key={coach.id}
                  onClick={() => updatePreferences({ coachPack: coach.id })}
                  aria-pressed={selected}
                  className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-push ${
                    selected
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-secondary text-secondary-foreground hover:bg-muted'
                  }`}
                >
                  <p className="font-semibold">{coach.name}</p>
                  <p
                    className={`text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                  >
                    {coach.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </SettingGroup>

        {/* --- Coaching ------------------------------------------------------ */}
        <SettingGroup
          title="Coaching"
          description="What the coach says and when."
        >
          <SettingRow
            label="Voice coaching"
            description="Spoken cues, counts, and encouragement during the workout."
            control={
              <Toggle
                checked={preferences.speechEnabled}
                onChange={toggleSpeech}
                label="Voice coaching"
              />
            }
          />
          <SettingRow
            label="Rest warning"
            description="Heads-up before the next round begins."
          >
            <SegmentedChoice
              options={[5, 10, 15] as const}
              value={preferences.restWarning}
              onChange={(seconds) => updatePreferences({ restWarning: seconds })}
              format={(s) => `${s}s`}
            />
          </SettingRow>
        </SettingGroup>

        {/* --- Voice --------------------------------------------------------- */}
        <SettingGroup title="Voice" description="How the coach's voice sounds.">
          <SettingRow label="Voice" htmlFor="voice-select">
            <select
              id="voice-select"
              value={preferences.voiceURI ?? ''}
              onChange={(e) =>
                updatePreferences({ voiceURI: e.target.value || null })
              }
              disabled={!isSupported || voices.length === 0}
              className="h-11 w-full rounded-xl bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-push disabled:opacity-50"
            >
              <option value="">Browser default</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
            {!isSupported && (
              <p className="mt-2 text-xs text-muted-foreground">
                Voice coaching isn&apos;t supported in this browser.
              </p>
            )}
          </SettingRow>

          <SettingRow
            label={`Speed · ${preferences.voiceRate.toFixed(1)}×`}
            htmlFor="voice-rate"
          >
            <input
              id="voice-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={preferences.voiceRate}
              onChange={(e) =>
                updateVoiceSettings(parseFloat(e.target.value), preferences.voicePitch)
              }
              className={sliderClass}
            />
          </SettingRow>

          <SettingRow
            label={`Pitch · ${preferences.voicePitch.toFixed(1)}×`}
            htmlFor="voice-pitch"
          >
            <input
              id="voice-pitch"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={preferences.voicePitch}
              onChange={(e) =>
                updateVoiceSettings(preferences.voiceRate, parseFloat(e.target.value))
              }
              className={sliderClass}
            />
          </SettingRow>

          <SettingRow
            label={`Volume · ${Math.round(preferences.volume * 100)}%`}
            htmlFor="voice-volume"
          >
            <input
              id="voice-volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.volume}
              onChange={(e) =>
                updatePreferences({ volume: parseFloat(e.target.value) })
              }
              className={sliderClass}
            />
          </SettingRow>
        </SettingGroup>

        {/* --- Sound --------------------------------------------------------- */}
        <SettingGroup title="Sound" description="Bells and transitions.">
          <SettingRow
            label="Round bells"
            description="Ring the bell on round and rest transitions."
            control={
              <Toggle
                checked={preferences.bellsEnabled}
                onChange={toggleBells}
                label="Round bells"
              />
            }
          />
        </SettingGroup>

        {/* --- Accessibility (informational) -------------------------------- */}
        <SettingGroup
          title="Accessibility"
          description="Corner follows your device."
        >
          <SettingRow
            label="Reduced motion"
            description="When your device asks for reduced motion, animations are turned off automatically."
          />
          <SettingRow
            label="Large text"
            description="Timer and cues stay legible with your system text-size settings."
          />
        </SettingGroup>

        {/* --- Application --------------------------------------------------- */}
        <SettingGroup title="Application">
          <SettingRow
            label="Reset to defaults"
            description="Restore all coaching and voice settings."
            control={
              <Button variant="outline" className="h-11 px-4" onClick={resetPreferences}>
                Reset
              </Button>
            }
          />
        </SettingGroup>
      </div>

      <div className="mt-10 text-center text-xs text-muted-foreground">
        <p>Corner v2.0 — the coach in your corner</p>
      </div>
    </PageContainer>
  );
}
