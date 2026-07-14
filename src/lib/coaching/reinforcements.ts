/**
 * Reinforcement — Layer 3 coaching (say it again, differently).
 *
 * When the same coaching *dimension* recurs inside a round, the coach must not
 * loop the identical line. Instead it reinforces the same lesson with fresh
 * wording — "Keep your hands high" → "Don't let them drop" → "Protect yourself".
 *
 * A cue is classified into a dimension; the first time a dimension is taught in a
 * round the authored line is spoken verbatim (respect authored content), and any
 * later same-dimension cue is voiced from that dimension's reinforcement pool,
 * rotated deterministically. These are authored phrases — no randomness, no AI.
 */

export type Dimension =
  | 'guard'
  | 'distance'
  | 'footwork'
  | 'breathing'
  | 'rhythm'
  | 'power'
  | 'head'
  | 'output'
  | 'general';

/** Keyword → dimension, checked most-specific first. */
const DIMENSION_KEYWORDS: ReadonlyArray<readonly [Dimension, readonly string[]]> = [
  ['breathing', ['breath', 'breathe', 'relax', 'loose', 'exhale', 'calm']],
  ['head', ['slip', 'roll', 'weave', 'duck', 'head movement', 'centre-line', 'center-line']],
  ['footwork', ['foot', 'feet', 'step', 'pivot', 'angle', 'circle', 'toes', 'balls of']],
  ['guard', ['hand', 'chin', 'guard', 'protect', 'cover', 'block', 'hands high']],
  ['power', ['power', 'hip', 'drive', 'sit down', 'explode', 'snap', 'turn it over', 'whip']],
  ['distance', ['distance', 'range', 'jab', 'reach', 'behind the jab', 'lead hand', 'long']],
  ['rhythm', ['rhythm', 'tempo', 'flow', 'timing', 'bounce', 'in and out']],
  ['output', ['combination', 'combo', 'flurry', 'work rate', 'busy', 'volume', 'throw', 'output']],
];

export function classifyDimension(text: string): Dimension {
  const t = text.toLowerCase();
  for (const [dimension, words] of DIMENSION_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return dimension;
  }
  return 'general';
}

/** Reinforcement phrase pools — same lesson, varied wording. */
export const REINFORCEMENTS: Readonly<Record<Dimension, readonly string[]>> = {
  guard: ["Don't let them drop.", 'Protect yourself.', 'Hands home.', 'Keep the guard up.'],
  distance: ['Own the distance.', 'Keep leading.', 'Make the jab work.', 'Control the range.'],
  footwork: ["Stay on your feet.", 'Keep cutting angles.', "Don't stop moving.", 'Own the floor.'],
  breathing: ['Stay relaxed.', 'Keep breathing.', 'Loose and easy.', "Don't tense up."],
  rhythm: ['Find the rhythm.', 'Stay in time.', 'Keep it flowing.', "Don't force it."],
  power: ['Sit down on it.', 'Drive from the floor.', 'Turn it over.', 'Snap it back.'],
  head: ['Keep the head moving.', "Don't be still.", 'Make him miss.', 'Off the centre-line.'],
  output: ['Keep the work rate up.', 'Stay busy.', "Don't slow down.", 'Keep punching.'],
  general: ['Stay sharp.', 'Keep it clean.', 'Stay focused.', 'Keep it going.'],
};

export function reinforcementBank(dimension: Dimension): readonly string[] {
  return REINFORCEMENTS[dimension];
}

/**
 * Encouragement that REFERENCES the lesson just taught (PR-020C) — "Good. Keep
 * that guard disciplined." — instead of a hollow "Great job". It reinforces the
 * concept without claiming to SEE the athlete: every line is an instruction about
 * the taught dimension, never an observation of performance.
 */
export const ENCOURAGEMENT_REFERENCE: Readonly<Record<Dimension, readonly string[]>> = {
  guard: ['Good work. Keep that guard disciplined.', 'Good. Keep protecting yourself.'],
  distance: ['Good work. Keep owning that distance.', 'Good. Keep leading behind the jab.'],
  footwork: ['Good work. Keep owning the floor.', 'Good. Keep those feet working.'],
  breathing: ['Good work. Keep that breathing easy.', 'Good. Stay relaxed and loose.'],
  rhythm: ['Good work. Keep that rhythm going.', 'Good. Stay in time.'],
  power: ['Good work. Keep sitting down on it.', 'Good. Keep driving from the floor.'],
  head: ['Good work. Keep that head moving.', 'Good. Stay off the centre-line.'],
  output: ['Good work. Keep that work rate up.', 'Good. Keep the hands busy.'],
  general: ['Good work. Keep it sharp.', 'Good. Stay focused.'],
};

export function encouragementReferenceBank(dimension: Dimension): readonly string[] {
  return ENCOURAGEMENT_REFERENCE[dimension];
}
