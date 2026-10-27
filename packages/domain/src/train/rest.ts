import type { RestExtra } from './types';

export const REST_EXTRAS: readonly RestExtra[] = ['off', 'quiz', 'memory'];

export function restExtraFrom(value: string | null | undefined): RestExtra {
  if (value === 'quiz' || value === 'memory') return value;
  return 'off';
}
