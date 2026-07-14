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

/**
 * Reinforcement phrase pools — the same lesson, varied wording (PR-020C), reshaped
 * to behavioural micro-coaching (PR-028). Doctrine is a coach walking the gym, not a
 * textbook: prefer "Hands home!" over "Maintain your defensive position." Every line
 * changes behaviour in as few words as possible (LAWS ONE & TWO).
 */
export const REINFORCEMENTS: Readonly<Record<Dimension, readonly string[]>> = {
  guard: ['Hands home!', 'Hands up!', 'Guard!', 'Protect!'],
  distance: ['Own the range!', 'Behind the jab!', 'Stay long!', 'Reach him!'],
  footwork: ['Move!', 'Angle out!', 'On your feet!', 'Cut the angle!'],
  breathing: ['Breathe!', 'Relax.', 'Loose.', 'Stay easy.'],
  rhythm: ['Find the rhythm.', 'In time!', 'Keep it flowing.', 'Stay smooth.'],
  power: ['Sit on it!', 'Turn it over!', 'Drive it!', 'Snap it!'],
  head: ['Head moving!', 'Off the line!', 'Make him miss!', 'Slip!'],
  output: ['Busy hands!', 'Stay busy!', 'More!', 'Keep punching!'],
  general: ['Sharp!', 'Stay clean!', 'Focus!', 'Keep it going!'],
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
  guard: ['Good. Hands home.', 'Yes — hands up.'],
  distance: ['Good. Own the range.', 'Yes — behind the jab.'],
  footwork: ['Good. Keep moving.', 'Yes — cut the angle.'],
  breathing: ['Good. Stay loose.', 'Yes — breathe easy.'],
  rhythm: ['Good. Stay in time.', 'Yes — keep it flowing.'],
  power: ['Good. Sit on it.', 'Yes — turn it over.'],
  head: ['Good. Head moving.', 'Yes — off the line.'],
  output: ['Good. Busy hands.', 'Yes — stay busy.'],
  general: ['Good. Stay sharp.', 'Yes — keep it clean.'],
};

export function encouragementReferenceBank(dimension: Dimension): readonly string[] {
  return ENCOURAGEMENT_REFERENCE[dimension];
}
