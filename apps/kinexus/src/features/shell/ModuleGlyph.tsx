import { Image, Platform, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { ModuleKey } from '@/src/features/shell/modules';
import { colors } from '@/src/features/shell/theme';

export type ModuleGlyphName = ModuleKey | 'settings';

const ICONS: Record<ModuleGlyphName, ImageSourcePropType> = {
  meals: require('../../../assets/images/nav/nav-meals.png'),
  lists: require('../../../assets/images/nav/nav-lists.png'),
  finances: require('../../../assets/images/nav/nav-money.png'),
  nutrition: require('../../../assets/images/nav/nav-nutrition.png'),
  train: require('../../../assets/images/nav/nav-train.png'),
  settings: require('../../../assets/images/nav/nav-more.png'),
};

type Props = {
  name: ModuleGlyphName;
  active?: boolean;
  size?: number;
};

function assetUri(source: ImageSourcePropType): string | undefined {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return Image.resolveAssetSource(source)?.uri;
}

export function ModuleGlyph({ name, active = false, size = 28 }: Props) {
  const color = active ? colors.accent : colors.textMuted;
  const source = ICONS[name];

  if (Platform.OS === 'web') {
    const uri = assetUri(source);
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.icon,
          {
            width: size,
            height: size,
            backgroundColor: color,
          },
          uri
            ? ({
                maskImage: `url("${uri}")`,
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                maskSize: 'contain',
              } as object)
            : null,
        ]}
      />
    );
  }

  return (
    <Image
      source={source}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      tintColor={color}
      style={[styles.icon, { width: size, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
  },
});
