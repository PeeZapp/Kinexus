import { describe, expect, it } from 'vitest';

import {
  normalizeDayTasks,
  normalizeNewsInterests,
  normalizeNewsTopicPriorities,
  normalizeOverviewWidgets,
  normalizeTopicPriorities,
  topicPriorityConfigsForInterests,
  weatherCodeLabel,
  weatherKind,
} from './index';

describe('overview widgets', () => {
  it('keeps known cards in order and drops duplicates', () => {
    expect(normalizeOverviewWidgets(['news', 'wordle', 'weather', 'meals', 'news'])).toEqual(['news', 'wordle', 'weather']);
  });

  it('keeps typed interests, maps old category ids, and drops duplicates', () => {
    expect(normalizeNewsInterests(['gaming', 'Gaming', 'technology', 'x', 'fashion week', 'finance'])).toEqual([
      'gaming',
      'Technology',
      'fashion week',
      'Business',
    ]);
  });

  it('keeps topic priorities in order and drops inactive categories', () => {
    expect(normalizeTopicPriorities('sport', ['nba', 'AFL', 'nba', 'x', 'Premier League'])).toEqual([
      'NBA',
      'AFL',
      'Premier League',
    ]);
    expect(normalizeTopicPriorities('business', ['asx', 'Nasdaq'])).toEqual(['ASX', 'Nasdaq']);
    expect(
      topicPriorityConfigsForInterests(['Sport', 'Film', 'Business']).map((config) => config.key),
    ).toEqual(['sport', 'film', 'business']);
    expect(
      normalizeNewsTopicPriorities(['Sport', 'Gaming'], {
        sport: ['AFL'],
        film: ['Horror'],
        gaming: ['Nintendo'],
      }),
    ).toEqual({ sport: ['AFL'], gaming: ['Nintendo'] });
  });

  it('keeps valid daily tasks and drops blanks', () => {
    expect(
      normalizeDayTasks([
        { id: 'task1', label: '  Stretch  ', done: false },
        { id: 'task1', label: 'Duplicate', done: true },
        { id: 'no', label: 'Too short an id', done: false },
        { id: 'task2', label: 'Call home', done: 1 },
      ]),
    ).toEqual([
      { id: 'task1', label: 'Stretch', done: false },
      { id: 'task2', label: 'Call home', done: false },
    ]);
  });

  it('labels a seven-day forecast code', () => {
    expect(weatherCodeLabel(0)).toBe('Clear');
    expect(weatherKind(0)).toBe('clear');
    expect(weatherCodeLabel(63)).toBe('Rain');
    expect(weatherKind(73)).toBe('snow');
    expect(weatherKind(95)).toBe('storm');
  });
});