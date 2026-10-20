import type {
  CreatorApplicationStatus,
  CreatorPublishDraft,
  CreatorQuestionnaire,
} from './types';

const URL_HINT = /^(https?:\/\/|www\.)/i;
const LOOSE_URL = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

export function isCreatorApplicationStatus(value: string): value is CreatorApplicationStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'revoked';
}

export function creatorStatusLabel(status: CreatorApplicationStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending review';
    case 'approved':
      return 'Approved creator';
    case 'rejected':
      return 'Not approved';
    case 'revoked':
      return 'Revoked';
  }
}

export function emptyCreatorQuestionnaire(displayName = ''): CreatorQuestionnaire {
  return {
    displayName,
    bio: '',
    expertise: '',
    portfolioUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    tiktokUrl: '',
    websiteUrl: '',
    otherLinks: '',
    valuePitch: '',
    originalityAttested: false,
  };
}

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

/** Normalize a user-entered URL for probing / storage. */
export function normalizeCreatorLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed) || trimmed.includes('.')) return `https://${trimmed}`;
  return null;
}

export function creatorSocialLinks(input: Pick<CreatorQuestionnaire, 'instagramUrl' | 'youtubeUrl' | 'tiktokUrl'>): string[] {
  return [input.instagramUrl, input.youtubeUrl, input.tiktokUrl]
    .map((value) => normalizeCreatorLink(value))
    .filter((value): value is string => Boolean(value));
}

/** Every non-empty link field the applicant filled in (for reachability checks). */
export function creatorLinksToVerify(input: CreatorQuestionnaire): string[] {
  const fromFields = [
    input.websiteUrl,
    input.portfolioUrl,
    input.instagramUrl,
    input.youtubeUrl,
    input.tiktokUrl,
  ]
    .map((value) => normalizeCreatorLink(value))
    .filter((value): value is string => Boolean(value));

  const fromOther: string[] = [];
  const other = input.otherLinks.trim();
  if (other) {
    const matches = other.match(LOOSE_URL) ?? [];
    for (const match of matches) {
      const normalized = normalizeCreatorLink(match.replace(/[),.]+$/, ''));
      if (normalized) fromOther.push(normalized);
    }
    if (matches.length === 0) {
      const normalized = normalizeCreatorLink(other);
      if (normalized) fromOther.push(normalized);
    }
  }

  return [...new Set([...fromFields, ...fromOther])];
}

export function creatorQuestionnaireError(input: CreatorQuestionnaire): string | null {
  if (!hasText(input.displayName)) return 'Add the name you want shown as a creator';
  if (!hasText(input.bio)) return 'Tell us about you';
  if (input.bio.trim().length < 20) return 'Tell us a bit more about you';
  if (!hasText(input.expertise)) return 'Tell us what qualifies you to be a creator';
  if (input.expertise.trim().length < 20) return 'Add a bit more about what qualifies you';

  const socials = creatorSocialLinks(input);
  if (socials.length < 1) {
    return 'Add at least one social profile (Instagram, YouTube, or TikTok) so we can message you there';
  }

  for (const raw of [
    input.websiteUrl,
    input.portfolioUrl,
    input.instagramUrl,
    input.youtubeUrl,
    input.tiktokUrl,
  ]) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!normalizeCreatorLink(trimmed)) {
      return 'Links should look like a website or social URL';
    }
    if (!URL_HINT.test(trimmed) && !trimmed.includes('.')) {
      return 'Links should look like a website or social URL';
    }
  }

  if (!input.originalityAttested) {
    return 'Confirm that your content is original or that you have rights to share it';
  }
  return null;
}

export function creatorPublishError(draft: CreatorPublishDraft): string | null {
  if (!draft.name.trim()) return 'Give the recipe a clear name before publishing';
  if (draft.ingredientsCount < 1) return 'Add at least one ingredient before publishing';
  if (draft.methodStepsCount < 1) return 'Add method steps before publishing';
  return null;
}

export function canApplyAsCreator(opts: {
  hasApprovedCreator: boolean;
  pendingApplication: boolean;
  submittedToday?: boolean;
}): boolean {
  return !opts.hasApprovedCreator && !opts.pendingApplication && !opts.submittedToday;
}
