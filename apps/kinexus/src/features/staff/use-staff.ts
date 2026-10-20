import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rpc, type Database } from '@kinexus/db';
import type { CreatorApplication, CreatorDigestItem, CreatorProfile } from '@kinexus/domain';

import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

type ApplicationRow = Database['public']['Tables']['creator_applications']['Row'];
type CreatorRow = Database['public']['Tables']['creators']['Row'];
type StaffRow = Database['public']['Tables']['platform_staff']['Row'];
type InviteRow = Database['public']['Tables']['platform_staff_invites']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

function mapApplication(row: ApplicationRow): CreatorApplication {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    displayName: row.display_name,
    bio: row.bio,
    expertise: row.expertise,
    portfolioUrl: row.portfolio_url ?? '',
    instagramUrl: row.instagram_url ?? '',
    youtubeUrl: row.youtube_url ?? '',
    tiktokUrl: row.tiktok_url ?? '',
    websiteUrl: row.website_url ?? '',
    otherLinks: row.other_links ?? '',
    valuePitch: row.value_pitch ?? '',
    originalityAttested: row.originality_attested,
    staffNotes: row.staff_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCreator(row: CreatorRow): CreatorProfile {
  return {
    userId: row.user_id,
    status: row.status === 'revoked' ? 'revoked' : 'approved',
    displayName: row.display_name,
    approvedAt: row.approved_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useStaffAccess() {
  const { user } = useAuth();
  const enabled = Boolean(supabase && user && !user.isDevBypass);

  const claimQuery = useQuery({
    queryKey: ['staff', 'claim', user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc(rpc.claimPlatformStaff);
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 60_000,
  });

  return {
    ready: !enabled || !claimQuery.isLoading,
    isStaff: Boolean(claimQuery.data),
    error: claimQuery.error?.message ?? null,
    refetch: claimQuery.refetch,
  };
}

export function useStaffDashboard(day = todayUtc()) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const access = useStaffAccess();
  const enabled = Boolean(supabase && user && access.isStaff);

  const digestQuery = useQuery({
    queryKey: ['staff', 'digest', day],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc(rpc.staffCreatorContentDigest, { p_day: day });
      if (error) throw error;
      return (data ?? []).map(
        (row): CreatorDigestItem => ({
          eventId: row.event_id,
          kind: row.kind,
          contentId: row.content_id,
          creatorId: row.creator_id,
          creatorDisplayName: row.creator_display_name,
          title: row.title,
          publishedAt: row.published_at,
        }),
      );
    },
  });

  const applicationsQuery = useQuery({
    queryKey: ['staff', 'applications'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('creator_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapApplication);
    },
  });

  const creatorsQuery = useQuery({
    queryKey: ['staff', 'creators'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!.from('creators').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapCreator);
    },
  });

  const teamQuery = useQuery({
    queryKey: ['staff', 'team'],
    enabled,
    queryFn: async () => {
      const [{ data: staff, error: staffError }, { data: invites, error: inviteError }] = await Promise.all([
        supabase!.from('platform_staff').select('*').order('created_at', { ascending: true }),
        supabase!.from('platform_staff_invites').select('*').order('created_at', { ascending: false }),
      ]);
      if (staffError) throw staffError;
      if (inviteError) throw inviteError;
      const ids = (staff ?? []).map((row: StaffRow) => row.user_id);
      let profiles: ProfileRow[] = [];
      if (ids.length) {
        const { data: profileRows, error: profileError } = await supabase!
          .from('profiles')
          .select('*')
          .in('id', ids);
        if (profileError) throw profileError;
        profiles = profileRows ?? [];
      }
      const byId = new Map(profiles.map((p) => [p.id, p]));
      return {
        staff: (staff ?? []).map((row: StaffRow) => ({
          userId: row.user_id,
          invitedBy: row.invited_by,
          createdAt: row.created_at,
          email: byId.get(row.user_id)?.email ?? null,
          displayName: byId.get(row.user_id)?.display_name ?? null,
        })),
        invites: (invites ?? []) as InviteRow[],
      };
    },
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
  }, [queryClient]);

  const reviewMutation = useMutation({
    mutationFn: async (input: { applicationId: string; action: 'approve' | 'reject'; notes?: string }) => {
      const { error } = await supabase!.rpc(rpc.reviewCreatorApplication, {
        p_application_id: input.applicationId,
        p_action: input.action,
        p_staff_notes: input.notes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const revokeCreatorMutation = useMutation({
    mutationFn: async (input: { userId: string; reason?: string }) => {
      const { error } = await supabase!.rpc(rpc.revokeCreator, {
        p_user_id: input.userId,
        p_reason: input.reason?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const inviteStaffMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase!.rpc(rpc.invitePlatformStaff, { p_email: email.trim() });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const revokeStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase!.rpc(rpc.revokePlatformStaff, { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return useMemo(
    () => ({
      access,
      day,
      digest: digestQuery.data ?? [],
      digestLoading: digestQuery.isLoading,
      applications: applicationsQuery.data ?? [],
      applicationsLoading: applicationsQuery.isLoading,
      creators: creatorsQuery.data ?? [],
      creatorsLoading: creatorsQuery.isLoading,
      team: teamQuery.data ?? { staff: [], invites: [] },
      teamLoading: teamQuery.isLoading,
      reviewApplication: reviewMutation.mutateAsync,
      reviewing: reviewMutation.isPending,
      revokeCreator: revokeCreatorMutation.mutateAsync,
      revokingCreator: revokeCreatorMutation.isPending,
      inviteStaff: inviteStaffMutation.mutateAsync,
      invitingStaff: inviteStaffMutation.isPending,
      revokeStaff: revokeStaffMutation.mutateAsync,
      revokingStaff: revokeStaffMutation.isPending,
      refresh: invalidate,
    }),
    [
      access,
      day,
      digestQuery.data,
      digestQuery.isLoading,
      applicationsQuery.data,
      applicationsQuery.isLoading,
      creatorsQuery.data,
      creatorsQuery.isLoading,
      teamQuery.data,
      teamQuery.isLoading,
      reviewMutation.mutateAsync,
      reviewMutation.isPending,
      revokeCreatorMutation.mutateAsync,
      revokeCreatorMutation.isPending,
      inviteStaffMutation.mutateAsync,
      inviteStaffMutation.isPending,
      revokeStaffMutation.mutateAsync,
      revokeStaffMutation.isPending,
      invalidate,
    ],
  );
}
