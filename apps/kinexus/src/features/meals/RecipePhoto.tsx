import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import type { Recipe } from '@kinexus/domain';

import { colors, radius } from '@/src/features/shell/theme';

export function recipePhotoUrl(recipes: readonly Recipe[], recipeId?: string | null): string | undefined {
  if (!recipeId) return undefined;
  return recipes.find((recipe) => recipe.id === recipeId)?.imageUrl;
}

export function RecipePhoto({
  uri,
  emoji,
  size = 56,
  radius: corner = radius.md,
  style,
}: {
  uri?: string | null;
  emoji?: string | null;
  size?: number | 'fill';
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const box: ViewStyle =
    size === 'fill'
      ? { width: '100%', height: '100%' }
      : { width: size, height: size };
  const img: ImageStyle = { width: '100%', height: '100%' };
  const showPhoto = Boolean(uri) && !failed;
  return (
    <View style={[styles.wrap, box, { borderRadius: corner }, style]}>
      {showPhoto ? (
        <Image source={{ uri: uri as string }} style={img} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.emoji, size === 'fill' && styles.emojiLarge]}>{emoji || '🍽️'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  emojiLarge: { fontSize: 40 },
});
