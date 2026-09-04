import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  CreatedInvite,
  Household,
  HouseholdInvite,
  HouseholdMember,
  HouseholdPerson,
  HouseholdRole,
  PeekedInvite,
  PersonType,
  Profile,
} from '@kinexus/domain';

import { useAuth, type AuthUser } from '@/src/lib/auth';
import { buildInviteUrl } from '@/src/lib/invite';
import {
  clearActiveHouseholdId,
  clearPendingInvite,
  readActiveHouseholdId,
  readPendingInvite,
  saveActiveHouseholdId,
} from '@/src/lib/storage';
import { supabase } from '@/src/lib/supabase';

type CreateHouseholdInput = {
  name: string;
  country?: string;
  currency?: string;
  timezone?: string;
};

type PersonInput = {
  name: string;
  personType: PersonType;
  dietary: string[];
};

type HouseholdContextValue = {
  isReady: boolean;
  error: string | null;
  pendingInviteToken: string | null;
  memberships: { household: Household; role: HouseholdRole; joinedAt: string }[];
  activeHousehold: Household | null;
  role: HouseholdRole | null;
  members: HouseholdMember[];
  people: HouseholdPerson[];
  invites: HouseholdInvite[];
  canManageInvites: boolean;
  setActiveHouseholdId: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  createHousehold: (input: CreateHouseholdInput) => Promise<string>;
  renameHousehold: (name: string) => Promise<void>;
  createInvite: (role: Exclude<HouseholdRole, 'owner'>) => Promise<CreatedInvite>;
  revokeInvite: (inviteId: string) => Promise<void>;
  peekInvite: (token: string) => Promise<PeekedInvite | null>;
  acceptInvite: (token: string) => Promise<string>;
  addPerson: (input: PersonInput) => Promise<void>;
  updatePerson: (id: string, input: PersonInput) => Promise<void>;
  removePerson: (id: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

function mapHousehold(row: {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  created_at: string;
}): Household {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    currency: row.currency,
    timezone: row.timezone,
    createdAt: row.created_at,
  };
}

function mapProfile(row: {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    email: row.email,
  };
}

function asErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

async function ensureProfile(user: AuthUser): Promise<void> {
  if (!supabase || user.isDevBypass) return;
  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: user.displayName,
      avatar_url: user.avatarUrl ?? null,
      email: user.email ?? null,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user, isReady: authReady } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<HouseholdContextValue['memberships']>([]);
  const [activeHouseholdId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [people, setPeople] = useState<HouseholdPerson[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);

  const load = useCallback(async (uid: string, preferredHouseholdId?: string | null) => {
    if (!supabase) {
      setMemberships([]);
      setActiveId(null);
      setMembers([]);
      setPeople([]);
      setInvites([]);
      return;
    }

    const { data, error: membershipError } = await supabase
      .from('household_members')
      .select('role, joined_at, household_id, households(*)')
      .eq('user_id', uid);

    if (membershipError) throw membershipError;

    const nextMemberships = (data ?? []).flatMap((row) => {
      const householdRow = row.households;
      if (!householdRow || Array.isArray(householdRow)) return [];
      return [
        {
          role: row.role,
          joinedAt: row.joined_at,
          household: mapHousehold(householdRow),
        },
      ];
    });

    setMemberships(nextMemberships);

    const storedId = preferredHouseholdId ?? (await readActiveHouseholdId());
    const resolvedId =
      nextMemberships.find((m) => m.household.id === storedId)?.household.id ??
      nextMemberships[0]?.household.id ??
      null;

    setActiveId(resolvedId);
    if (resolvedId) {
      await saveActiveHouseholdId(resolvedId);
    } else {
      await clearActiveHouseholdId();
    }

    if (!resolvedId) {
      setMembers([]);
      setPeople([]);
      setInvites([]);
      return;
    }

    const [membersRes, peopleRes, invitesRes] = await Promise.all([
      supabase
        .from('household_members')
        .select('user_id, role, joined_at, profiles(*)')
        .eq('household_id', resolvedId),
      supabase.from('household_people').select('*').eq('household_id', resolvedId).order('name'),
      supabase
        .from('household_invites')
        .select('id, household_id, email, role, expires_at, accepted_at, revoked_at, created_at')
        .eq('household_id', resolvedId)
        .order('created_at', { ascending: false }),
    ]);

    if (membersRes.error) throw membersRes.error;
    if (peopleRes.error) throw peopleRes.error;
    // Invites are owner/admin-only via RLS; ignore permission failures for members.
    if (invitesRes.error && invitesRes.error.code !== '42501' && !/permission|policy/i.test(invitesRes.error.message)) {
      throw invitesRes.error;
    }

    setMembers(
      (membersRes.data ?? []).flatMap((row) => {
        const profileRow = row.profiles;
        if (!profileRow || Array.isArray(profileRow)) return [];
        return [
          {
            userId: row.user_id,
            role: row.role,
            joinedAt: row.joined_at,
            profile: mapProfile(profileRow),
          },
        ];
      }),
    );

    setPeople(
      (peopleRes.data ?? []).map((row) => ({
        id: row.id,
        householdId: row.household_id,
        userId: row.user_id,
        name: row.name,
        personType: row.person_type,
        birthday: row.birthday,
        dietary: row.dietary ?? [],
      })),
    );

    setInvites(
      (invitesRes.data ?? []).map((row) => ({
        id: row.id,
        householdId: row.household_id,
        email: row.email,
        role: row.role === 'owner' ? 'member' : row.role,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
      })),
    );
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    async function boot() {
      setError(null);
      try {
        const pending = await readPendingInvite();
        if (!cancelled) setPendingInviteToken(pending);

        if (!user) {
          setMemberships([]);
          setActiveId(null);
          setMembers([]);
          setPeople([]);
          setInvites([]);
          setIsReady(true);
          return;
        }

        setIsReady(false);
        await ensureProfile(user);
        if (cancelled) return;
        await load(user.id);
      } catch (err) {
        if (!cancelled) setError(asErrorMessage(err, 'Could not load household'));
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [authReady, load, user]);

  const activeMembership = memberships.find((m) => m.household.id === activeHouseholdId) ?? null;
  const activeHousehold = activeMembership?.household ?? null;
  const role = activeMembership?.role ?? null;
  const canManageInvites = role === 'owner' || role === 'admin';

  const refresh = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      await load(user.id, activeHouseholdId);
    } catch (err) {
      setError(asErrorMessage(err, 'Could not refresh household'));
    }
  }, [activeHouseholdId, load, user]);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      isReady,
      error,
      pendingInviteToken,
      memberships,
      activeHousehold,
      role,
      members,
      people,
      invites,
      canManageInvites,
      setActiveHouseholdId: async (id: string) => {
        setActiveId(id);
        await saveActiveHouseholdId(id);
        if (user) await load(user.id, id);
      },
      refresh,
      createHousehold: async (input) => {
        if (!supabase || !user || user.isDevBypass) {
          throw new Error('Sign in with Google to create a household');
        }
        const { data, error: rpcError } = await supabase.rpc('create_household', {
          p_name: input.name.trim(),
          p_country: input.country ?? null,
          p_currency: input.currency ?? null,
          p_timezone: input.timezone ?? null,
        });
        if (rpcError) throw rpcError;
        if (!data) throw new Error('Create household did not return an id');
        await saveActiveHouseholdId(data);
        await load(user.id, data);
        return data;
      },
      renameHousehold: async (name: string) => {
        if (!supabase || !activeHousehold) throw new Error('No household selected');
        const { error: updateError } = await supabase
          .from('households')
          .update({ name: name.trim() })
          .eq('id', activeHousehold.id);
        if (updateError) throw updateError;
        if (user) await load(user.id, activeHousehold.id);
      },
      createInvite: async (inviteRole) => {
        if (!supabase || !activeHousehold || !user) throw new Error('No household selected');
        const { data, error: rpcError } = await supabase.rpc('create_household_invite', {
          p_household_id: activeHousehold.id,
          p_role: inviteRole,
        });
        if (rpcError) throw rpcError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error('Invite was not created');
        await load(user.id, activeHousehold.id);
        return {
          inviteId: row.invite_id,
          token: row.token,
          url: buildInviteUrl(row.token),
          expiresAt: row.expires_at,
        };
      },
      revokeInvite: async (inviteId: string) => {
        if (!supabase || !user) throw new Error('Not signed in');
        const { error: rpcError } = await supabase.rpc('revoke_household_invite', {
          p_invite_id: inviteId,
        });
        if (rpcError) throw rpcError;
        await load(user.id, activeHouseholdId);
      },
      peekInvite: async (token: string) => {
        if (!supabase) throw new Error('Supabase is not configured');
        const { data, error: rpcError } = await supabase.rpc('peek_household_invite', {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;
        return {
          householdName: row.household_name,
          role: row.role,
          expiresAt: row.expires_at,
        };
      },
      acceptInvite: async (token: string) => {
        if (!supabase || !user || user.isDevBypass) {
          throw new Error('Sign in with Google to accept an invite');
        }
        const { data, error: rpcError } = await supabase.rpc('accept_household_invite', {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        if (!data) throw new Error('Accept invite did not return a household');
        await clearPendingInvite();
        setPendingInviteToken(null);
        await saveActiveHouseholdId(data);
        await load(user.id, data);
        return data;
      },
      addPerson: async (input) => {
        if (!supabase || !activeHousehold) throw new Error('No household selected');
        const { error: insertError } = await supabase.from('household_people').insert({
          household_id: activeHousehold.id,
          name: input.name.trim(),
          person_type: input.personType,
          dietary: input.dietary,
        });
        if (insertError) throw insertError;
        if (user) await load(user.id, activeHousehold.id);
      },
      updatePerson: async (id, input) => {
        if (!supabase || !user) throw new Error('Not signed in');
        const { error: updateError } = await supabase
          .from('household_people')
          .update({
            name: input.name.trim(),
            person_type: input.personType,
            dietary: input.dietary,
          })
          .eq('id', id);
        if (updateError) throw updateError;
        await load(user.id, activeHouseholdId);
      },
      removePerson: async (id) => {
        if (!supabase || !user) throw new Error('Not signed in');
        const { error: deleteError } = await supabase.from('household_people').delete().eq('id', id);
        if (deleteError) throw deleteError;
        await load(user.id, activeHouseholdId);
      },
      leaveHousehold: async () => {
        if (!supabase || !user || !activeHousehold) throw new Error('No household selected');
        const { error: rpcError } = await supabase.rpc('leave_household', {
          p_household_id: activeHousehold.id,
        });
        if (rpcError) throw rpcError;
        await load(user.id);
      },
    }),
    [
      activeHousehold,
      activeHouseholdId,
      canManageInvites,
      error,
      invites,
      isReady,
      load,
      members,
      memberships,
      pendingInviteToken,
      people,
      refresh,
      role,
      user,
    ],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error('useHousehold must be used within HouseholdProvider');
  }
  return ctx;
}
