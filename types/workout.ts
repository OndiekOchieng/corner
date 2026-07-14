export interface CoachingCue {
  id: string;
  text: string;
  timeSeconds?: number;
  timing?: 'start' | 'middle' | 'end';
}

// Alias for backwards compatibility
export type DrillCue = CoachingCue;

export interface Round {
  id: string;
  name: string;
  drillDuration: number;
  restDuration: number;
  currentDrill: string;
  currentCue: DrillCue;
  nextCue?: DrillCue;
  coachingCues: DrillCue[];
}

export interface Workout {
  id: string;
  name: string;
  description: string;
  stance: 'orthodox' | 'southpaw' | 'both';
  totalDuration: number;
  roundDuration: number;
  restDuration: number;
  roundCount: number;
  rounds: Round[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** The session's focus, e.g. "distance control" — framed by the coach's opening (PR-020B). */
  focus?: string;
  /** An explicit objective sentence, if authored (falls back to `focus`). */
  objective?: string;
}

export enum WorkoutPhase {
  IDLE = 'idle',
  WARMUP = 'warmup',
  ROUND_ACTIVE = 'round_active',
  REST = 'rest',
  FINISHED = 'finished',
}

export interface TimerState {
  phase: WorkoutPhase;
  currentRound: number;
  timeRemaining: number; // in seconds
  isRunning: boolean;
  isPaused: boolean;
  elapsedTime: number; // total time elapsed in current phase
}

export interface WorkoutSession {
  id: string;
  workoutId: string;
  startedAt: Date;
  completedAt?: Date;
  currentRound: number;
  isPaused: boolean;
  phase: WorkoutPhase;
  timeRemaining: number;
  rating?: number;
  notes?: string;
}

/** The six Coach Packs (mirrors CoachPackId in the Coach Runtime). */
export type CoachPack =
  | 'technical'
  | 'oldschool'
  | 'fightnight'
  | 'calm'
  | 'competition'
  | 'southpaw';

export interface UserPreferences {
  speechEnabled: boolean;
  bellsEnabled: boolean;
  voiceRate: number; // 0.5 to 2.0
  voicePitch: number; // 0.5 to 2.0
  volume: number; // 0 to 1.0
  voiceURI: string | null; // selected speech-synthesis voice (null = browser default)
  coachPack: CoachPack; // which coach is in your corner
  theme: 'dark' | 'light';
  restWarning: number; // seconds before rest ends (5, 10, 15)
}

export interface CustomWorkout extends Workout {
  isCustom: true;
  createdAt: Date;
  lastModified: Date;
  tags?: string[];
}

export interface AppState {
  selectedWorkout?: Workout;
  currentSession?: WorkoutSession;
  currentRound: number;
  isPaused: boolean;
}
