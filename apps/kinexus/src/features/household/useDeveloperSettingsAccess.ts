import { useQuery } from '@tanstack/react-query';

import { rpc } from '@kinexus/db';

import { useStaffAccess } from '@/src/features/staff/use-staff';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

/** Who can see Settings → Developer (staff + catalog tools + private staff alerts). */
export function useDeveloperSettingsAccess() {
  const { user } = useAuth();
  const staff = useStaffAccess();

  const editorQuery = useQuery({
    queryKey: ['settings', 'catalog-editor', user?.id],
    enabled: Boolean(user?.id && supabase && !user.isDevBypass),
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc(rpc.claimCatalogEditor);
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 60_000,
  });

  const isStaff = staff.isStaff;
  const isCatalogEditor = Boolean(editorQuery.data);
  const showTab = isStaff || isCatalogEditor;

  return {
    ready: staff.ready && !editorQuery.isLoading,
    showTab,
    isStaff,
    isCatalogEditor,
  };
}
