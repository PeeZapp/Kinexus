import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '@/src/features/shell/theme';
import {
  useWatchlistCatalogProvider,
  type WatchlistCatalogProvider,
} from '@/src/features/stash/watchlist-provider-switch';

export function WatchlistProviderToggle() {
  const { provider, visible, setProvider, previewOnly } = useWatchlistCatalogProvider();
  if (!visible) return null;

  function pick(next: WatchlistCatalogProvider) {
    if (next === provider) return;
    setProvider(next);
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.row}>
          <Pressable
            onPress={() => pick('tmdb')}
            style={[styles.option, provider === 'tmdb' && styles.optionOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: provider === 'tmdb' }}
          >
            <Text style={[styles.label, provider === 'tmdb' && styles.labelOn]}>TMDB</Text>
          </Pressable>
          <Pressable
            onPress={() => pick('trakt')}
            style={[styles.option, provider === 'trakt' && styles.optionOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: provider === 'trakt' }}
          >
            <Text style={[styles.label, provider === 'trakt' && styles.labelOn]}>Trakt</Text>
          </Pressable>
        </View>
        {previewOnly ? <Text style={styles.hint}>Preview only</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: space.md,
    bottom: space.lg,
    zIndex: 40,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 6,
    gap: 4,
  },
  row: { flexDirection: 'row', gap: 4 },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  optionOn: { backgroundColor: colors.bg },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  labelOn: { color: colors.text },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', paddingBottom: 2 },
});
