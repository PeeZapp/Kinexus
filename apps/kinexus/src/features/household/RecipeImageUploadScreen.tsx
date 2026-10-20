import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { rpc } from '@kinexus/db';

import { BackLink, Btn, ErrorText } from '@/src/features/household/ui';
import {
  matchZipToRecipes,
  readRecipeImageZip,
} from '@/src/features/household/recipe-image-zip';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { useHousehold } from '@/src/lib/household';
import { supabase } from '@/src/lib/supabase';

const BUCKET = 'catalog-recipe-images';
const MAX_BYTES = 5_242_880;

type MissingRecipe = {
  id: string;
  name: string;
  emoji: string | null;
  catalogKey: string | null;
  scope: 'catalog' | 'household';
};

type RowStatus = {
  phase: 'idle' | 'uploading' | 'done' | 'error';
  previewUrl?: string;
  message?: string;
};

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

function pickImageFile(): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function pickZipFile(): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip,application/x-zip-compressed';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function DropRow({
  style,
  children,
  disabled,
  onHoverChange,
  onFile,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  disabled?: boolean;
  onHoverChange: (over: boolean) => void;
  onFile: (file: File) => void;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) onHoverChange(true);
    };
    const onDragLeave = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onHoverChange(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onHoverChange(false);
      if (disabled) return;
      const file = event.dataTransfer?.files?.[0];
      if (file) onFile(file);
    };

    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
  }, [disabled, onFile, onHoverChange]);

  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
}

async function uploadRecipeImage(
  recipe: Pick<MissingRecipe, 'id' | 'scope'>,
  file: File,
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const contentType = file.type.startsWith('image/')
    ? file.type
    : file.name.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.name.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : file.name.toLowerCase().endsWith('.gif')
          ? 'image/gif'
          : 'image/jpeg';
  if (file.size > MAX_BYTES) throw new Error('Image must be under 5 MB');

  const ext = extForMime(contentType);
  const path = `${recipe.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = data.publicUrl;
  if (!imageUrl.startsWith('https://')) throw new Error('Public URL was not https');

  if (recipe.scope === 'catalog') {
    const { error: reviewError } = await supabase.rpc(rpc.reviewCatalogImage, {
      p_recipe_id: recipe.id,
      p_action: 'set_url',
      p_image_url: imageUrl,
    });
    if (reviewError) throw reviewError;
  } else {
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ image_url: imageUrl, image_flagged: false })
      .eq('id', recipe.id)
      .not('household_id', 'is', null);
    if (updateError) throw updateError;
  }
  return imageUrl;
}

export function RecipeImageUploadScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeHousehold } = useHousehold();
  const householdId = activeHousehold?.id ?? null;
  const [filter, setFilter] = useState('');
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [zipOver, setZipOver] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [zipSummary, setZipSummary] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const uploadingRef = useRef(false);

  const editorQuery = useQuery({
    queryKey: ['meals', 'catalog-editor', user?.id],
    enabled: Boolean(user?.id && supabase),
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc(rpc.claimCatalogEditor);
      if (error) throw error;
      return Boolean(data);
    },
  });

  const listQueryKey = ['settings', 'recipes-missing-images', householdId] as const;

  const listQuery = useQuery({
    queryKey: listQueryKey,
    enabled: Boolean(supabase && editorQuery.data),
    queryFn: async (): Promise<MissingRecipe[]> => {
      if (!supabase) return [];
      const catalogPromise = supabase
        .from('recipes')
        .select('id, name, emoji, catalog_key')
        .is('household_id', null)
        .is('image_url', null)
        .eq('removed', false)
        .like('catalog_key', 'seed_%')
        .order('name');

      const householdPromise = householdId
        ? supabase
            .from('recipes')
            .select('id, name, emoji, catalog_key')
            .eq('household_id', householdId)
            .is('image_url', null)
            .eq('removed', false)
            .order('name')
        : Promise.resolve({ data: [] as const, error: null });

      const [catalog, household] = await Promise.all([catalogPromise, householdPromise]);
      if (catalog.error) throw catalog.error;
      if (household.error) throw household.error;

      const catalogRows = (catalog.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        catalogKey: row.catalog_key,
        scope: 'catalog' as const,
      }));
      const householdRows = (household.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        catalogKey: row.catalog_key,
        scope: 'household' as const,
      }));

      return [...householdRows, ...catalogRows].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ recipe, file }: { recipe: MissingRecipe; file: File }) => {
      const previewUrl = URL.createObjectURL(file);
      setRowStatus((prev) => ({
        ...prev,
        [recipe.id]: { phase: 'uploading', previewUrl },
      }));
      try {
        const imageUrl = await uploadRecipeImage(recipe, file);
        setRowStatus((prev) => ({
          ...prev,
          [recipe.id]: { phase: 'done', previewUrl: imageUrl },
        }));
        return recipe.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setRowStatus((prev) => ({
          ...prev,
          [recipe.id]: { phase: 'error', previewUrl, message },
        }));
        throw err;
      }
    },
    onSuccess: async (recipeId) => {
      await queryClient.invalidateQueries({ queryKey: ['meals', 'recipes'] });
      await queryClient.setQueryData<MissingRecipe[]>(listQueryKey, (list) =>
        (list ?? []).filter((row) => row.id !== recipeId),
      );
    },
  });

  const recipes = listQuery.data ?? [];
  const householdCount = useMemo(
    () => recipes.filter((row) => row.scope === 'household').length,
    [recipes],
  );
  const catalogCount = recipes.length - householdCount;
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (q === 'mine' && row.scope === 'household') ||
        (q === 'catalog' && row.scope === 'catalog'),
    );
  }, [filter, recipes]);

  const assignFile = useCallback(
    async (recipe: MissingRecipe, file: File | null | undefined) => {
      if (!file || uploadingRef.current) return;
      uploadingRef.current = true;
      try {
        await uploadMutation.mutateAsync({ recipe, file });
      } finally {
        uploadingRef.current = false;
      }
    },
    [uploadMutation],
  );

  const importZip = useCallback(
    async (file: File | null | undefined) => {
      if (!file || zipBusy) return;
      setZipError(null);
      setZipSummary(null);
      setZipBusy(true);
      setZipProgress('Reading zip…');
      try {
        if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip') {
          throw new Error('Drop a .zip of images named after each dish');
        }
        const entries = await readRecipeImageZip(file);
        if (!entries.length) throw new Error('No images found in that zip');

        const current = queryClient.getQueryData<MissingRecipe[]>(listQueryKey) ?? recipes;
        const byId = new Map(current.map((row) => [row.id, row]));
        const { matched, unmatchedFiles, unmatchedRecipes } = matchZipToRecipes(entries, current);
        if (!matched.length) {
          throw new Error(
            unmatchedFiles.length
              ? `No filenames matched dish names. Example file: ${unmatchedFiles[0]}`
              : 'No filenames matched dish names',
          );
        }

        let ok = 0;
        let failed = 0;
        for (let i = 0; i < matched.length; i += 1) {
          const item = matched[i]!;
          const recipe = byId.get(item.recipeId);
          if (!recipe) {
            failed += 1;
            continue;
          }
          setZipProgress(`Uploading ${i + 1} of ${matched.length}: ${item.recipeName}`);
          try {
            uploadingRef.current = true;
            await uploadMutation.mutateAsync({
              recipe,
              file: item.entry.file,
            });
            ok += 1;
          } catch {
            failed += 1;
          } finally {
            uploadingRef.current = false;
          }
        }

        const parts = [`Saved ${ok} of ${matched.length}`];
        if (failed) parts.push(`${failed} failed`);
        if (unmatchedFiles.length) parts.push(`${unmatchedFiles.length} zip files unmatched`);
        if (unmatchedRecipes.length) parts.push(`${unmatchedRecipes.length} recipes still missing`);
        setZipSummary(parts.join(' · '));
      } catch (err) {
        setZipError(err instanceof Error ? err.message : 'Zip import failed');
      } finally {
        setZipBusy(false);
        setZipProgress(null);
      }
    },
    [listQueryKey, queryClient, recipes, uploadMutation, zipBusy],
  );

  const copyName = useCallback(async (recipe: MissingRecipe) => {
    await Clipboard.setStringAsync(recipe.name);
    setCopiedId(recipe.id);
    setTimeout(() => setCopiedId((id) => (id === recipe.id ? null : id)), 1500);
  }, []);

  if (editorQuery.isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!editorQuery.data) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <BackLink label="Settings" onPress={() => router.replace('/settings')} />
        <Text style={styles.kicker}>Catalog</Text>
        <Text style={styles.title}>Recipe images</Text>
        <Text style={styles.lede}>
          Only the catalog editor can upload seed recipe photos. Open Meals once as a household owner
          to claim that role, then return here.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackLink label="Settings" onPress={() => router.replace('/settings')} />
      <Text style={styles.kicker}>Meals</Text>
      <Text style={styles.title}>Recipe images</Text>
      <Text style={styles.lede}>
        {recipes.length} recipes still need a photo
        {householdCount || catalogCount
          ? ` (${householdCount} yours · ${catalogCount} catalog)`
          : ''}
        . Drop a zip of images named after each dish, or drag a single file onto a row. Filter with
        “mine” or “catalog”.
      </Text>
      <ErrorText
        message={
          zipError ??
          (listQuery.error instanceof Error
            ? listQuery.error.message
            : uploadMutation.error instanceof Error
              ? uploadMutation.error.message
              : null)
        }
      />

      {Platform.OS === 'web' ? (
        <DropRow
          style={[styles.zipDrop, zipOver && styles.rowOver]}
          disabled={zipBusy}
          onHoverChange={setZipOver}
          onFile={(file) => {
            void importZip(file);
          }}>
          <Text style={styles.zipTitle}>{zipBusy ? 'Importing zip…' : 'Drop recipe image zip'}</Text>
          <Text style={styles.zipHint}>
            {zipProgress ??
              'Each file should be named the dish title. Accents and punctuation are ignored when matching.'}
          </Text>
          {zipSummary ? <Text style={styles.zipSummary}>{zipSummary}</Text> : null}
          <Btn
            label={zipBusy ? 'Working…' : 'Choose zip'}
            variant="secondary"
            disabled={zipBusy}
            busy={zipBusy}
            onPress={() => {
              void pickZipFile().then((file) => void importZip(file));
            }}
          />
        </DropRow>
      ) : null}

      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filter by name…"
        placeholderTextColor={colors.textDim}
        style={styles.filter}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {listQuery.isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>
          {recipes.length === 0 ? 'All listed recipes have images.' : 'No matches for that filter.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((recipe) => {
            const status = rowStatus[recipe.id];
            const busy = status?.phase === 'uploading';
            const over = dragOverId === recipe.id;
            return (
              <DropRow
                key={recipe.id}
                style={[styles.row, over && styles.rowOver, status?.phase === 'error' && styles.rowError]}
                disabled={busy || zipBusy}
                onHoverChange={(hover) => setDragOverId(hover ? recipe.id : null)}
                onFile={(file) => {
                  if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
                    void importZip(file);
                    return;
                  }
                  void assignFile(recipe, file);
                }}>
                <View style={styles.thumb}>
                  {status?.previewUrl ? (
                    <Image source={{ uri: status.previewUrl }} style={styles.thumbImage} />
                  ) : (
                    <Text style={styles.emoji}>{recipe.emoji || '🍽️'}</Text>
                  )}
                </View>
                <View style={styles.meta}>
                  <Text style={styles.name}>{recipe.name}</Text>
                  <Text style={styles.hint}>
                    {recipe.scope === 'household' ? 'Your household · ' : 'Catalog · '}
                    {busy
                      ? 'Uploading…'
                      : status?.phase === 'error'
                        ? status.message ?? 'Upload failed'
                        : over
                          ? 'Drop to save'
                          : 'Drop image here'}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void copyName(recipe)}
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                    <Text style={styles.chipLabel}>{copiedId === recipe.id ? 'Copied' : 'Copy name'}</Text>
                  </Pressable>
                  {Platform.OS === 'web' ? (
                    <Btn
                      label="Choose"
                      variant="secondary"
                      disabled={busy || zipBusy}
                      busy={busy}
                      onPress={() => {
                        void pickImageFile().then((file) => void assignFile(recipe, file));
                      }}
                    />
                  ) : null}
                </View>
              </DropRow>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: 64,
    maxWidth: 900,
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: space.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.sm,
    maxWidth: 640,
  },
  zipDrop: {
    gap: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    borderStyle: 'dashed',
  },
  zipTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  zipHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  zipSummary: {
    color: colors.accent,
    fontSize: 14,
    lineHeight: 20,
  },
  filter: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: space.md,
  },
  list: {
    gap: 10,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    borderStyle: 'dashed',
  },
  rowOver: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  rowError: {
    borderColor: colors.danger,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 28,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: colors.textDim,
    fontSize: 13,
  },
  actions: {
    gap: 8,
    alignItems: 'stretch',
    minWidth: 110,
  },
  chip: {
    minHeight: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
