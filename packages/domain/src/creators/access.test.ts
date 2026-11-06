import { describe, expect, it } from 'vitest';

import {
  creatorQuestionnaireError,
  creatorReviewChecklistError,
  emptyCreatorQuestionnaire,
  extractCreatorHandleFromUrl,
  normalizeRequestedUsername,
  suggestRequestedCreatorHandle,
} from './access';

describe('creator handle extraction', () => {
  it('extracts Instagram / TikTok / YouTube handles', () => {
    expect(extractCreatorHandleFromUrl('https://instagram.com/Sunny.Chef')).toBe('sunny.chef');
    expect(extractCreatorHandleFromUrl('https://www.tiktok.com/@Fit.Paul/video/1')).toBe('fit.paul');
    expect(extractCreatorHandleFromUrl('https://youtube.com/@CookWithUs')).toBe('cookwithus');
    expect(extractCreatorHandleFromUrl('https://youtube.com/c/CookWithUs')).toBe('cookwithus');
  });

  it('suggests from the first filled social', () => {
    expect(
      suggestRequestedCreatorHandle({
        instagramUrl: '',
        youtubeUrl: 'https://youtube.com/@KitchenLab',
        tiktokUrl: 'https://tiktok.com/@later',
      }),
    ).toEqual({ username: 'later', platform: 'tiktok' });
  });

  it('normalizes requested usernames', () => {
    expect(normalizeRequestedUsername('@Sunny.Chef!!')).toBe('sunny.chef');
  });
});

describe('creatorQuestionnaireError', () => {
  it('requires requested username + matching platform social', () => {
    const form = {
      ...emptyCreatorQuestionnaire('Ada'),
      bio: 'I cook seasonal meals for busy households every week.',
      expertise: 'Ten years teaching weeknight recipes on social video.',
      instagramUrl: 'https://instagram.com/ada.cooks',
      originalityAttested: true,
      requestedPlatform: 'instagram' as 'instagram' | 'tiktok' | 'youtube' | '',
      requestedUsername: '',
    };
    expect(creatorQuestionnaireError(form)).toMatch(/username/i);

    form.requestedUsername = 'ada.cooks';
    form.requestedPlatform = 'tiktok';
    expect(creatorQuestionnaireError(form)).toMatch(/TikTok/i);

    form.requestedPlatform = 'instagram';
    expect(creatorQuestionnaireError(form)).toBeNull();
  });
});

describe('creatorReviewChecklistError', () => {
  it('blocks approve without DM verification checks', () => {
    expect(
      creatorReviewChecklistError({ contactedViaDm: false, creatorConfirmed: true, notes: '' }, 'approve'),
    ).toMatch(/contacted/i);
    expect(
      creatorReviewChecklistError({ contactedViaDm: true, creatorConfirmed: false, notes: '' }, 'approve'),
    ).toMatch(/confirmed/i);
    expect(
      creatorReviewChecklistError({ contactedViaDm: true, creatorConfirmed: true, notes: 'ok' }, 'approve'),
    ).toBeNull();
    expect(
      creatorReviewChecklistError({ contactedViaDm: false, creatorConfirmed: false, notes: '' }, 'reject'),
    ).toBeNull();
  });
});
