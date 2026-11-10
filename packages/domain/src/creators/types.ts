export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type CreatorContentKind = 'recipe';

export type CreatorPlatform = 'instagram' | 'youtube' | 'tiktok';

export type CreatorQuestionnaire = {
  displayName: string;
  bio: string;
  expertise: string;
  portfolioUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
  otherLinks: string;
  valuePitch: string;
  originalityAttested: boolean;
  requestedUsername: string;
  requestedPlatform: CreatorPlatform | '';
};

export type CreatorApplication = CreatorQuestionnaire & {
  id: string;
  userId: string;
  status: CreatorApplicationStatus;
  staffNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  contactedViaDm: boolean;
  creatorConfirmed: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatorProfile = {
  userId: string;
  status: Extract<CreatorApplicationStatus, 'approved' | 'revoked'>;
  displayName: string;
  approvedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  verifiedHandle: string | null;
  verifiedPlatform: CreatorPlatform | null;
};

export type CreatorDigestItem = {
  eventId: string;
  kind: CreatorContentKind;
  contentId: string;
  creatorId: string;
  creatorDisplayName: string;
  title: string;
  publishedAt: string;
};

export type CreatorPublishDraft = {
  name: string;
  ingredientsCount: number;
  methodStepsCount: number;
};

export type CreatorReviewChecklist = {
  contactedViaDm: boolean;
  creatorConfirmed: boolean;
  notes: string;
};

/** Public creator page — no real name, email, or household fields. */
export type PublicProfileLink = {
  url: string;
  label?: string;
};

export type PublicProfile = {
  permanentId: string;
  handle: string;
  avatarPreset: string | null;
  isVerified: boolean;
  bio: string | null;
  links: PublicProfileLink[];
};

export type ProfileItemKind = 'recipe' | 'workout' | 'plan' | 'watchlist';

export type ProfileItem = {
  id: string;
  kind: ProfileItemKind;
  title: string;
  imageUrl: string | null;
  publishedAt: string;
};

export type CreatorSearchHit = {
  permanentId: string;
  handle: string;
  avatarPreset: string | null;
  isVerified: boolean;
};
