import { StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { rpc } from '@kinexus/db';

import { Btn, Card } from '@/src/features/household/ui';
import { colors } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

/** Catalog-editor shortcut into the seed-recipe image backfill utility. */
export function RecipeImageUploadLink() {
  const router = useRouter();
  const { user } = useAuth();

  const editorQuery = useQuery({
    queryKey: ['meals', 'catalog-editor', user?.id],
    enabled: Boolean(user?.id && supabase),
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc(rpc.claimCatalogEditor);
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 60_000,
  });

  if (!editorQuery.data) return null;

  return (
    <Card>
      <Text style={styles.heading}>Catalog images</Text>
      <Btn
        label="Open image checklist"
        onPress={() => router.push('/settings/recipe-images' as Href)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
