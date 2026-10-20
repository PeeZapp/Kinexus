export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type CreatorContentKind = 'recipe';

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
};

export type CreatorApplication = CreatorQuestionnaire & {
  id: string;
  userId: string;
  status: CreatorApplicationStatus;
  staffNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
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
