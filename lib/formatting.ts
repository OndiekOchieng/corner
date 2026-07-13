export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

export function formatRoundTime(roundDuration: number, restDuration: number, roundCount: number): string {
  const totalSeconds = (roundDuration + restDuration) * roundCount - restDuration;
  return formatDuration(totalSeconds);
}

export function getPhaseDuration(phaseType: 'work' | 'rest', roundDuration: number, restDuration: number): number {
  return phaseType === 'work' ? roundDuration : restDuration;
}

export function getPhaseLabel(phaseType: 'work' | 'rest'): string {
  return phaseType === 'work' ? 'Round' : 'Rest';
}
