export type HouseholdRole = 'owner' | 'admin' | 'member';
export type PersonType = 'adult' | 'child' | 'other';

export type Household = {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  createdAt: string;
};

export type Profile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
};

export type HouseholdMember = {
  userId: string;
  role: HouseholdRole;
  joinedAt: string;
  profile: Profile;
};

export type HouseholdPerson = {
  id: string;
  householdId: string;
  userId: string | null;
  name: string;
  personType: PersonType;
  birthday: string | null;
  dietary: string[];
};

export type HouseholdInvite = {
  id: string;
  householdId: string;
  email: string | null;
  role: Exclude<HouseholdRole, 'owner'>;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedInvite = {
  inviteId: string;
  token: string;
  url: string;
  expiresAt: string;
};

export type PeekedInvite = {
  householdName: string;
  role: HouseholdRole;
  expiresAt: string;
};
