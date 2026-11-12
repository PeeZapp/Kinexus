import { describe, expect, it } from 'vitest';

import {
  defaultTrackingTargets,
  formatTrackingTarget,
  inferTracking,
  trackingCompatTargets,
  trackingToUnit,
  unitToTracking,
} from './tracking.js';

describe('inferTracking', () => {
  it('picks min for walking and treadmill run', () => {
    expect(inferTracking({ name: 'Walking', category: 'Legs' })).toBe('min');
    expect(inferTracking({ name: 'Treadmill Run', canonicalKey: 'running treadmill' })).toBe('min');
  });

  it('picks sec for plank, dead hang, sprint intervals, and hold instructions', () => {
    expect(inferTracking({ name: 'Plank', category: 'Core' })).toBe('sec');
    expect(inferTracking({ name: 'Dead Hang', category: 'Back' })).toBe('sec');
    expect(inferTracking({ name: 'Sprint intervals', category: 'Cardio' })).toBe('sec');
    expect(
      inferTracking({
        name: 'Hamstring Stretch',
        category: 'Mobility',
        instructions: ['Hold for 30 seconds, then switch sides.'],
      }),
    ).toBe('sec');
  });

  it('keeps strength and plain mobility as reps; Cardio category defaults to min', () => {
    expect(inferTracking({ name: 'Bench Press', category: 'Chest' })).toBe('reps');
    expect(inferTracking({ name: 'Standing Quad Stretch', category: 'Mobility' })).toBe('reps');
    expect(inferTracking({ name: 'Zone 2 Block', category: 'Cardio' })).toBe('min');
  });

  it('picks km or m from distance wording', () => {
    expect(inferTracking({ name: 'Row 2 km', category: 'Cardio' })).toBe('km');
    expect(
      inferTracking({
        name: 'Outdoor Run',
        category: 'Cardio',
        instructions: ['Run for distance at an easy pace.'],
      }),
    ).toBe('km');
    expect(inferTracking({ name: '400 m Repeats', category: 'Cardio' })).toBe('m');
    expect(
      inferTracking({
        name: 'Track Sprints',
        instructions: ['6 × 200 m with walk-back recovery.'],
      }),
    ).toBe('m');
  });
});

describe('unitToTracking / trackingToUnit', () => {
  it('maps units to tracking and back', () => {
    expect(unitToTracking('reps')).toBe('reps');
    expect(unitToTracking('sec')).toBe('intervals');
    expect(unitToTracking('min')).toBe('time');
    expect(unitToTracking('km')).toBe('distance');
    expect(unitToTracking('m')).toBe('distance');
    expect(trackingToUnit('reps')).toBe('reps');
    expect(trackingToUnit('intervals')).toBe('sec');
    expect(trackingToUnit('time')).toBe('min');
    expect(trackingToUnit('distance')).toBe('km');
    expect(trackingToUnit('distance', { targetDistanceKm: 0.2 })).toBe('m');
  });
});

describe('defaultTrackingTargets / formatTrackingTarget / compat', () => {
  it('defaults min to 30 min and sec to 3 × 30 s', () => {
    expect(defaultTrackingTargets('min')).toMatchObject({
      tracking: 'time',
      targetUnit: 'min',
      targetSets: 1,
      targetReps: '30 min',
      targetDurationSec: 1800,
      targetDistanceKm: null,
    });
    expect(defaultTrackingTargets('sec')).toMatchObject({
      tracking: 'intervals',
      targetUnit: 'sec',
      targetSets: 3,
      targetReps: '30 s',
      targetDurationSec: 30,
    });
  });

  it('formats targets for each unit', () => {
    expect(
      formatTrackingTarget({
        tracking: 'time',
        targetUnit: 'min',
        targetSets: 1,
        targetReps: '45 min',
        targetDurationSec: 45 * 60,
        targetDistanceKm: 5,
      }),
    ).toBe('45 min · 5 km');
    expect(
      formatTrackingTarget({
        tracking: 'intervals',
        targetUnit: 'sec',
        targetSets: 3,
        targetReps: '45 s',
        targetDurationSec: 45,
      }),
    ).toBe('3 × 45 s');
    expect(
      formatTrackingTarget({
        tracking: 'reps',
        targetUnit: 'reps',
        targetSets: 3,
        targetReps: '10-12',
      }),
    ).toBe('3 × 10-12');
    expect(
      formatTrackingTarget({
        tracking: 'distance',
        targetUnit: 'km',
        targetSets: 1,
        targetReps: '2 km',
        targetDistanceKm: 2,
      }),
    ).toBe('2 km');
    expect(
      formatTrackingTarget({
        tracking: 'distance',
        targetUnit: 'm',
        targetSets: 6,
        targetReps: '200 m',
        targetDistanceKm: 0.2,
      }),
    ).toBe('6 × 200 m');
  });

  it('writes readable target_reps for legacy screens', () => {
    expect(
      trackingCompatTargets({
        tracking: 'time',
        targetUnit: 'min',
        targetSets: 1,
        targetReps: '10',
        targetDurationSec: 45 * 60,
        targetDistanceKm: 5,
      }),
    ).toMatchObject({
      targetSets: 1,
      targetReps: '45 min',
      targetDurationSec: 2700,
      targetDistanceKm: 5,
      targetUnit: 'min',
    });
    expect(
      trackingCompatTargets({
        tracking: 'intervals',
        targetUnit: 'sec',
        targetSets: 3,
        targetReps: '10',
        targetDurationSec: 45,
        targetDistanceKm: null,
      }),
    ).toMatchObject({ targetSets: 3, targetReps: '45 s', targetDurationSec: 45, targetUnit: 'sec' });
  });
});
