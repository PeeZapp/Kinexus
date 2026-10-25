import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rpc, type Database } from '@kinexus/db';
import {
  canApplyAsCreator,
  creatorQuestionnaireError,
  type CreatorApplication,
  type CreatorProfile,
  type CreatorQuestionnaire,
} from '@kinexus/domain';

import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

type ApplicationRow = Database['public']['Tables']['creator_applications']['Row'];
type CreatorRow = Database['public']['Tables']['creators']['Row'];

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

export function useCreator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const enabled = Boolean(supabase && userId && !user?.isDevBypass);

  const creatorQuery = useQuery({
    queryKey: ['creators', 'me', userId],
    enabled,
    queryFn: async () => {
      const { error: grantError } = await supabase!.rpc(rpc.ensureCatalogOwnerAccess);
      if (grantError && grantError.code !== 'PGRST202') throw grantError;
      const { data, error } = await supabase!
        .from('creators')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapCreator(data) : null;
    },
  });

  const applicationsQuery = useQuery({
    queryKey: ['creators', 'applications', 'me', userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('creator_applications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapApplication);
    },
  });

  const creator = creatorQuery.data ?? null;
  const applications = applicationsQuery.data ?? [];
  const latestApplication = applications[0] ?? null;
  const pendingApplication = applications.find((a) => a.status === 'pending') ?? null;
  const isApprovedCreator = creator?.status === 'approved';

  const submitMutation = useMutation({
    mutationFn: async (form: CreatorQuestionnaire) => {
      const validation = creatorQuestionnaireError(form);
      if (validation) throw new Error(validation);
      if (!supabase) throw new Error('Sign in to apply');
      const { data, error } = await supabase.rpc(rpc.submitCreatorApplication, {
        p_display_name: form.displayName.trim(),
        p_bio: form.bio.trim(),
        p_expertise: form.expertise.trim(),
        p_portfolio_url: form.portfolioUrl.trim() || null,
        p_instagram_url: form.instagramUrl.trim() || null,
        p_youtube_url: form.youtubeUrl.trim() || null,
        p_tiktok_url: form.tiktokUrl.trim() || null,
        p_website_url: form.websiteUrl.trim() || null,
        p_other_links: form.otherLinks.trim() || null,
        p_value_pitch: '',
        p_originality_attested: form.originalityAttested,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['creators'] });
    },
  });

  const refresh = useCallback(async () => {
    await Promise.all([creatorQuery.refetch(), applicationsQuery.refetch()]);
  }, [creatorQuery, applicationsQuery]);

  return useMemo(
    () => ({
      online: enabled,
      isLoading: enabled && (creatorQuery.isLoading || applicationsQuery.isLoading),
      creator,
      applications,
      latestApplication,
      pendingApplication,
      isApprovedCreator,
      canApply: canApplyAsCreator({
        hasApprovedCreator: isApprovedCreator,
        pendingApplication: Boolean(pendingApplication),
      }),
      submitApplication: submitMutation.mutateAsync,
      submitting: submitMutation.isPending,
      refresh,
    }),
    [
      enabled,
      creatorQuery.isLoading,
      applicationsQuery.isLoading,
      creator,
      applications,
      latestApplication,
      pendingApplication,
      isApprovedCreator,
      submitMutation.mutateAsync,
      submitMutation.isPending,
      refresh,
    ],
  );
}
