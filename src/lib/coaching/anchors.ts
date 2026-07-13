/**
 * Time anchors — Layer 2 coaching (cadence + time-awareness).
 *
 * Anchors orient the athlete inside a round ("one minute left"). They are AUTHORED
 * content: a workout carries anchor cues (or the integration mapper injects sensible
 * defaults), the engine schedules them like any cue, and the Coach Runtime voices
 * them here — inheriting the coach's personality. No runtime timing logic, no
 * randomness: the wording rotates deterministically, the scheduling is the engine's.
 */

import type { CoachPackId } from './CoachAction';

export type AnchorKind = 'two_min' | 'one_min' | 'halfway' | 'thirty' | 'twenty';

/** Anchor cues use a reserved id so the Director can tell them from technique cues. */
const ID_TO_KIND: Readonly<Record<string, AnchorKind>> = {
  'anchor-twomin': 'two_min',
  'anchor-onemin': 'one_min',
  'anchor-halfway': 'halfway',
  'anchor-thirty': 'thirty',
  'anchor-twenty': 'twenty',
};

export const ANCHOR_IDS: Readonly<Record<AnchorKind, string>> = {
  two_min: 'anchor-twomin',
  one_min: 'anchor-onemin',
  halfway: 'anchor-halfway',
  thirty: 'anchor-thirty',
  twenty: 'anchor-twenty',
};

/** True for any reserved anchor id. */
export function isAnchorId(cueId: string): boolean {
  return cueId in ID_TO_KIND;
}

/** The anchor kind for a cue id, or null when it isn't an anchor. */
export function parseAnchorKind(cueId: string): AnchorKind | null {
  return ID_TO_KIND[cueId] ?? null;
}

/**
 * Personality-voiced anchor lines. Each already carries one short instruction so
 * the anchor both orients AND coaches ("One minute left. Stay disciplined."). Same
 * event, different performance per coach — rotated deterministically for variety.
 */
export const ANCHOR_BANKS: Readonly<Record<CoachPackId, Readonly<Record<AnchorKind, readonly string[]>>>> = {
  technical: {
    two_min: ['Two minutes to go. Stay precise.', 'Two minutes. Hold the shape.'],
    one_min: ['One minute remaining. Stay disciplined.', 'One minute. Keep it clean.'],
    halfway: ['Halfway. Keep the form honest.', 'Halfway now. Sharp and controlled.'],
    thirty: ['Thirty seconds. Sharpen up.', 'Thirty. Finish precise.'],
    twenty: ['Twenty seconds. Clean to the end.', 'Twenty. Hold the detail.'],
  },
  oldschool: {
    two_min: ['Two minutes. Get to work.', 'Two minutes left. Dig in.'],
    one_min: ["One minute! Don't give it away!", 'One minute. Earn it.'],
    halfway: ['Halfway there. Dig in.', 'Halfway. Keep working.'],
    thirty: ['Thirty seconds! Work!', 'Thirty. Empty it.'],
    twenty: ['Twenty seconds — finish!', 'Twenty. Leave nothing.'],
  },
  fightnight: {
    two_min: ['Two minutes to go — settle in.', 'Two minutes. Build it up.'],
    one_min: ['One minute! This round is yours!', 'One minute — take it!'],
    halfway: ['Halfway — this is your round!', 'Halfway. Turn it up!'],
    thirty: ['Thirty seconds — pour it on!', 'Thirty! Big finish!'],
    twenty: ['Twenty seconds — empty the tank!', 'Twenty! Everything now!'],
  },
  calm: {
    two_min: ['Two minutes left. Keep breathing.', 'Two minutes. Nice and easy.'],
    one_min: ['One minute left. Stay easy.', 'One minute. Keep it smooth.'],
    halfway: ['Halfway. Nice and smooth.', 'Halfway now. Stay relaxed.'],
    thirty: ['Thirty seconds. Stay relaxed.', 'Thirty. Smooth to the end.'],
    twenty: ['Twenty seconds. Easy does it.', 'Twenty. Breathe it home.'],
  },
  competition: {
    two_min: ['Two minutes. Hold the standard.', 'Two minutes to go. Stay on it.'],
    one_min: ['One minute. Championship rounds.', "One minute. Don't drop off."],
    halfway: ['Halfway. This is where it counts.', 'Halfway. Raise the bar.'],
    thirty: ["Thirty seconds. Don't cheat it.", 'Thirty. Prove it now.'],
    twenty: ["Twenty seconds. Everything you've got.", 'Twenty. Championship finish.'],
  },
  southpaw: {
    two_min: ['Two minutes. Own the outside.', 'Two minutes to go. Keep the angle.'],
    one_min: ['One minute. Make him chase.', 'One minute. Own the outside foot.'],
    halfway: ['Halfway. Keep taking the angle.', 'Halfway. Straight left working.'],
    thirty: ['Thirty seconds. Straight left home.', 'Thirty. Take the angle.'],
    twenty: ['Twenty seconds. Own it to the bell.', 'Twenty. Angle and fire.'],
  },
};

export function anchorBank(id: CoachPackId, kind: AnchorKind): readonly string[] {
  return ANCHOR_BANKS[id][kind];
}
