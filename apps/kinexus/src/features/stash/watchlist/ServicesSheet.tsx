import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { STREAMING_SERVICE_LIMIT, tmdbImageUrl, type StreamingServiceOption } from '@kinexus/domain';

import { Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';
import { listStreamingServices } from '@/src/features/stash/watchlist-api';
import type { WatchlistStreamingPrefs } from '@/src/features/stash/watchlist-prefs';

export function ServicesSheet({
  visible,
  country,
  prefs,
  onChange,
  onClose,
  error,
}: {
  visible: boolean;
  country: string;
  prefs: WatchlistStreamingPrefs;
  onChange: (next: WatchlistStreamingPrefs) => void;
  onClose: () => void;
  error?: string | null;
}) {
  const [services, setServices] = useState<StreamingServiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setLocalError(null);
    void listStreamingServices(country)
      .then((rows) => {
        if (!cancelled) setServices(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setServices([]);
        setLocalError(err instanceof Error ? err.message : 'Could not load streaming services');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, visible]);

  function toggle(providerId: number) {
    const selected = prefs.providerIds.includes(providerId);
    if (!selected && prefs.providerIds.length >= STREAMING_SERVICE_LIMIT) return;
    onChange({
      ...prefs,
      providerIds: selected ? prefs.providerIds.filter((id) => id !== providerId) : [...prefs.providerIds, providerId],
    });
  }

  const known = new Set(services.map((service) => service.providerId));
  const missing = loading ? [] : prefs.providerIds.filter((id) => !known.has(id));

  return (
    <Sheet visible={visible} title="Streaming services" onClose={onClose} wide>
      <View style={styles.stack}>
        <Text style={styles.hint}>
          Select the services you have in {country}. Recommendations can stay on those, or include every title.
        </Text>
        <Text style={styles.section}>Recommendations</Text>
        <View style={styles.wrap}>
          <Pill
            label="Only my services"
            active={prefs.recommendScope === 'subscribed'}
            onPress={() => onChange({ ...prefs, recommendScope: 'subscribed' })}
          />
          <Pill
            label="Show all"
            active={prefs.recommendScope === 'all'}
            onPress={() => onChange({ ...prefs, recommendScope: 'all' })}
          />
        </View>
        <Text style={styles.hint}>
          {prefs.recommendScope === 'subscribed'
            ? 'What next, Surprise me, and Something like this only suggest titles on the services you select.'
            : 'Recommendations can include titles that are not on your services.'}
        </Text>
        {prefs.recommendScope === 'subscribed' && prefs.providerIds.length === 0 ? (
          <Text style={styles.hint}>Pick at least one service to limit recommendations.</Text>
        ) : null}
        <Text style={styles.section}>Services you have</Text>
        {loading && services.length === 0 ? <Text style={styles.hint}>Loading services…</Text> : null}
        {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        <View style={styles.wrap}>
          {services.map((service) => {
            const selected = prefs.providerIds.includes(service.providerId);
            const logo = tmdbImageUrl(service.logoPath, 'w45');
            return (
              <Pressable
                key={service.providerId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggle(service.providerId)}
                style={[styles.service, selected && styles.serviceOn]}>
                {logo ? <Image source={{ uri: logo }} style={styles.logo} /> : <View style={styles.logo} />}
                <Text style={[styles.serviceName, selected && styles.serviceNameOn]}>{service.providerName}</Text>
              </Pressable>
            );
          })}
          {missing.map((id) => (
            <Pressable
              key={`missing-${id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: true }}
              onPress={() => toggle(id)}
              style={[styles.service, styles.serviceOn]}>
              <Text style={[styles.serviceName, styles.serviceNameOn]}>Saved service</Text>
            </Pressable>
          ))}
        </View>
        {!loading && services.length === 0 && !localError ? (
          <Text style={styles.hint}>No streaming services are listed for {country} yet.</Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { color: colors.text, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  serviceOn: { borderColor: colors.accent },
  logo: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.bg },
  serviceName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  serviceNameOn: { color: colors.accent },
});
