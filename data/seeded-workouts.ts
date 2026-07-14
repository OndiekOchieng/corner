import { Workout } from '@/types/workout';

export const SEEDED_WORKOUTS: Workout[] = [
  {
    id: 'workout-orthodox-power',
    focus: 'straight-punch power and footwork',
    name: 'Orthodox Power',
    description: 'Build power and precision from orthodox stance with focus on straight punches and footwork',
    stance: 'orthodox',
    totalDuration: 1260,
    roundDuration: 180,
    restDuration: 60,
    roundCount: 3,
    difficulty: 'intermediate',
    rounds: [
      {
        id: 'round-1-power',
        name: 'POWER FOUNDATION',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Orthodox Power',
        currentCue: {
          id: 'cue-1',
          text: 'Keep hands high, feet shoulder-width apart',
        },
        coachingCues: [
          {
            id: 'cue-1',
            text: 'Keep hands high, feet shoulder-width apart',
            timeSeconds: 0,
          },
          {
            id: 'cue-2',
            text: 'Rotate hips with every punch for power',
            timeSeconds: 45,
          },
          {
            id: 'cue-3',
            text: 'Stay on the balls of your feet',
            timeSeconds: 90,
          },
          {
            id: 'cue-4',
            // Semantic combination (PR-020D): each Coach Pack voices [1,2,3] its own
            // way. `text` is the authoring fallback for older readers.
            kind: 'combination',
            combination: [1, 2, 3], // jab · cross · lead hook
            text: 'Push through the finish with jab, cross, hook',
            timeSeconds: 135,
          },
        ],
      },
      {
        id: 'round-2-power',
        name: 'JAB & CROSS DRILL',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Orthodox Power',
        currentCue: {
          id: 'cue-5',
          text: 'Throw sharp jabs to set up the cross',
        },
        coachingCues: [
          {
            id: 'cue-5',
            text: 'Throw sharp jabs to set up the cross',
            timeSeconds: 0,
          },
          {
            id: 'cue-6',
            text: 'Full weight transfer on the cross',
            timeSeconds: 60,
          },
          {
            id: 'cue-7',
            text: 'Reset stance after each combination',
            timeSeconds: 120,
          },
        ],
      },
      {
        id: 'round-3-power',
        name: 'POWER COMBINATIONS',
        drillDuration: 180,
        restDuration: 0,
        currentDrill: 'Orthodox Power',
        currentCue: {
          id: 'cue-8',
          text: 'Combine all techniques: jab, cross, hook, uppercut',
        },
        coachingCues: [
          {
            id: 'cue-8',
            kind: 'combination',
            combination: [1, 2, 3, 6], // jab · cross · lead hook · rear uppercut
            text: 'Combine all techniques: jab, cross, hook, uppercut',
            timeSeconds: 0,
          },
          {
            id: 'cue-9',
            text: 'Flow seamlessly between combinations',
            timeSeconds: 60,
          },
          {
            id: 'cue-10',
            text: 'Maintain explosive power throughout round',
            timeSeconds: 120,
          },
        ],
      },
    ],
  },
  {
    id: 'workout-southpaw-fundamentals',
    focus: 'southpaw footwork and positioning',
    name: 'Southpaw Fundamentals',
    description: 'Master southpaw stance with emphasis on footwork, positioning, and defensive movement',
    stance: 'southpaw',
    totalDuration: 1260,
    roundDuration: 180,
    restDuration: 60,
    roundCount: 3,
    difficulty: 'beginner',
    rounds: [
      {
        id: 'round-1-south',
        name: 'STANCE & FOOTWORK',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Southpaw Fundamentals',
        currentCue: {
          id: 'cue-11',
          text: 'Feet shoulder-width apart, right foot forward',
        },
        coachingCues: [
          {
            id: 'cue-11',
            text: 'Feet shoulder-width apart, right foot forward',
            timeSeconds: 0,
          },
          {
            id: 'cue-12',
            text: 'Circle the bag with controlled footwork',
            timeSeconds: 60,
          },
          {
            id: 'cue-13',
            text: 'Maintain 45-degree angle to the bag',
            timeSeconds: 120,
          },
        ],
      },
      {
        id: 'round-2-south',
        name: 'BASIC COMBINATIONS',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Southpaw Fundamentals',
        currentCue: {
          id: 'cue-14',
          text: 'Lead with left hand jab from southpaw',
        },
        coachingCues: [
          {
            id: 'cue-14',
            text: 'Lead with left hand jab from southpaw',
            timeSeconds: 0,
          },
          {
            id: 'cue-15',
            text: 'Follow with right cross for power',
            timeSeconds: 90,
          },
        ],
      },
      {
        id: 'round-3-south',
        name: 'FLOW & RHYTHM',
        drillDuration: 180,
        restDuration: 0,
        currentDrill: 'Southpaw Fundamentals',
        currentCue: {
          id: 'cue-16',
          text: 'Move with rhythm and precision',
        },
        coachingCues: [
          {
            id: 'cue-16',
            text: 'Move with rhythm and precision',
            timeSeconds: 0,
          },
          {
            id: 'cue-17',
            text: 'Maintain consistent hand position',
            timeSeconds: 120,
          },
        ],
      },
    ],
  },
  {
    id: 'workout-heavy-bag-cardio',
    focus: 'speed, endurance, and continuous output',
    name: 'Heavy Bag Cardio',
    description: 'High-intensity cardio workout focusing on speed, endurance, and continuous movement',
    stance: 'both',
    totalDuration: 840,
    roundDuration: 120,
    restDuration: 60,
    roundCount: 4,
    difficulty: 'advanced',
    rounds: [
      {
        id: 'round-1-cardio',
        name: 'WARM-UP PACE',
        drillDuration: 120,
        restDuration: 60,
        currentDrill: 'Heavy Bag Cardio',
        currentCue: {
          id: 'cue-18',
          text: 'Find your rhythm with steady combinations',
        },
        coachingCues: [
          {
            id: 'cue-18',
            text: 'Find your rhythm with steady combinations',
            timeSeconds: 0,
          },
        ],
      },
      {
        id: 'round-2-cardio',
        name: 'INCREASED INTENSITY',
        drillDuration: 120,
        restDuration: 60,
        currentDrill: 'Heavy Bag Cardio',
        currentCue: {
          id: 'cue-19',
          text: 'Pick up the pace, throw more volume',
        },
        coachingCues: [
          {
            id: 'cue-19',
            text: 'Pick up the pace, throw more volume',
            timeSeconds: 0,
          },
          {
            id: 'cue-20',
            text: 'Keep moving your feet constantly',
            timeSeconds: 60,
          },
        ],
      },
      {
        id: 'round-3-cardio',
        name: 'HIGH INTENSITY',
        drillDuration: 120,
        restDuration: 60,
        currentDrill: 'Heavy Bag Cardio',
        currentCue: {
          id: 'cue-21',
          text: 'Go hard - maximum speed and volume',
        },
        coachingCues: [
          {
            id: 'cue-21',
            text: 'Go hard - maximum speed and volume',
            timeSeconds: 0,
          },
        ],
      },
      {
        id: 'round-4-cardio',
        name: 'FINISH STRONG',
        drillDuration: 120,
        restDuration: 0,
        currentDrill: 'Heavy Bag Cardio',
        currentCue: {
          id: 'cue-22',
          text: 'Push through to the end with everything you have',
        },
        coachingCues: [
          {
            id: 'cue-22',
            text: 'Push through to the end with everything you have',
            timeSeconds: 0,
          },
        ],
      },
    ],
  },
  {
    id: 'workout-footwork-mastery',
    focus: 'precise footwork and angles',
    name: 'Footwork Mastery',
    description: 'Advanced footwork drill focusing on precision positioning and defensive movement',
    stance: 'both',
    totalDuration: 900,
    roundDuration: 180,
    restDuration: 60,
    roundCount: 3,
    difficulty: 'advanced',
    rounds: [
      {
        id: 'round-1-foot',
        name: 'LATERAL MOVEMENT',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Footwork Mastery',
        currentCue: {
          id: 'cue-23',
          text: 'Slide side to side with quick small steps',
        },
        coachingCues: [
          {
            id: 'cue-23',
            text: 'Slide side to side with quick small steps',
            timeSeconds: 0,
          },
          {
            id: 'cue-24',
            text: 'Keep weight on balls of feet',
            timeSeconds: 90,
          },
        ],
      },
      {
        id: 'round-2-foot',
        name: 'CIRCULAR FOOTWORK',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Footwork Mastery',
        currentCue: {
          id: 'cue-25',
          text: 'Circle the bag maintaining distance and angle',
        },
        coachingCues: [
          {
            id: 'cue-25',
            text: 'Circle the bag maintaining distance and angle',
            timeSeconds: 0,
          },
          {
            id: 'cue-26',
            text: 'Change direction smoothly',
            timeSeconds: 120,
          },
        ],
      },
      {
        id: 'round-3-foot',
        name: 'ADVANCED POSITIONING',
        drillDuration: 180,
        restDuration: 0,
        currentDrill: 'Footwork Mastery',
        currentCue: {
          id: 'cue-27',
          text: 'Combine all footwork techniques flawlessly',
        },
        coachingCues: [
          {
            id: 'cue-27',
            text: 'Combine all footwork techniques flawlessly',
            timeSeconds: 0,
          },
          {
            id: 'cue-28',
            text: 'Move as one unit - head, hands, feet',
            timeSeconds: 120,
          },
        ],
      },
    ],
  },
  {
    id: 'workout-fight-simulation',
    focus: 'composure under pressure',
    name: 'Fight Simulation',
    description: 'Realistic fight scenario with varied intensities and patterns to simulate ring conditions',
    stance: 'both',
    totalDuration: 1440,
    roundDuration: 180,
    restDuration: 60,
    roundCount: 4,
    difficulty: 'advanced',
    rounds: [
      {
        id: 'round-1-sim',
        name: 'EARLY ROUND PACE',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Fight Simulation',
        currentCue: {
          id: 'cue-29',
          text: 'Start controlled, feel out the round',
        },
        coachingCues: [
          {
            id: 'cue-29',
            text: 'Start controlled, feel out the round',
            timeSeconds: 0,
          },
          {
            id: 'cue-30',
            text: 'Establish your jab',
            timeSeconds: 90,
          },
        ],
      },
      {
        id: 'round-2-sim',
        name: 'BUILD MOMENTUM',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Fight Simulation',
        currentCue: {
          id: 'cue-31',
          text: 'Increase volume and intensity gradually',
        },
        coachingCues: [
          {
            id: 'cue-31',
            text: 'Increase volume and intensity gradually',
            timeSeconds: 0,
          },
          {
            id: 'cue-32',
            text: 'Mix it up - vary your combinations',
            timeSeconds: 120,
          },
        ],
      },
      {
        id: 'round-3-sim',
        name: 'MID-FIGHT INTENSITY',
        drillDuration: 180,
        restDuration: 60,
        currentDrill: 'Fight Simulation',
        currentCue: {
          id: 'cue-33',
          text: 'Push hard but stay smart with defense',
        },
        coachingCues: [
          {
            id: 'cue-33',
            text: 'Push hard but stay smart with defense',
            timeSeconds: 0,
          },
        ],
      },
      {
        id: 'round-4-sim',
        name: 'CHAMPIONSHIP ROUND',
        drillDuration: 180,
        restDuration: 0,
        currentDrill: 'Fight Simulation',
        currentCue: {
          id: 'cue-34',
          text: 'Final round - leave everything in the ring',
        },
        coachingCues: [
          {
            id: 'cue-34',
            text: 'Final round - leave everything in the ring',
            timeSeconds: 0,
          },
          {
            id: 'cue-35',
            text: 'Finish strong with your best combinations',
            timeSeconds: 120,
          },
        ],
      },
    ],
  },
];
