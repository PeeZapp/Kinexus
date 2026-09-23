import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Btn, ErrorText, Field, Pill } from '@/src/features/household/ui';
import { ArchivePageFrame } from '@/src/features/stash/reader/ArchivePageFrame';
import { StashChrome } from '@/src/features/stash/StashShared';
import {
  fetchStashReader,
  isStashApiConfigured,
  type ArchiveViewSource,
  type ReaderDocument,
  type ReaderSource,
} from '@/src/features/stash/stash-api';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

type ViewMode = 'page' | 'text';

function sourceLabel(source: ReaderSource): string {
  if (source === 'jina') return 'Jina Reader';
  if (source === 'archive_is') return 'archive.is';
  return 'Wayback Machine';
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function looksLikeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

function documentViews(document: ReaderDocument): ArchiveViewSource[] {
  if (document.views?.length) return document.views;
  if (document.viewUrl) {
    return [{ id: 'wayback', label: 'Wayback', url: document.viewUrl }];
  }
  return [];
}

export function ReaderScreen() {
  const { mode } = useExperienceMode();
  const desktop = mode === 'desktop';
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  const paramUrl = firstParam(params.url);

  const [url, setUrl] = useState(paramUrl);
  const [document, setDocument] = useState<ReaderDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('page');
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    if (paramUrl) setUrl(paramUrl);
  }, [paramUrl]);

  const load = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    setError(null);
    setDocument(null);
    setViewerId(null);
    if (!trimmed) {
      setError('Paste a URL to read.');
      return;
    }
    if (!looksLikeUrl(trimmed)) {
      setError('Enter a full http(s) URL.');
      return;
    }
    if (!isStashApiConfigured()) {
      setError('Reader API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
      return;
    }
    setBusy(true);
    try {
      const result = await fetchStashReader(trimmed);
      const views = documentViews(result.document);
      setDocument(result.document);
      const preferred = views.find((view) => view.id === 'wayback') ?? views[0];
      setViewerId(preferred?.id ?? null);
      setViewMode(views.length > 0 ? 'page' : 'text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that page');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (paramUrl && looksLikeUrl(paramUrl)) {
      void load(paramUrl);
    }
  }, [load, paramUrl]);

  const views = useMemo(() => (document ? documentViews(document) : []), [document]);
  const activeView = views.find((view) => view.id === viewerId) ?? views[0] ?? null;

  return (
    <StashChrome
      desktop={desktop}
      kicker="Library"
      title="Reader"
      subtitle="Open a public cached or archived copy — Wayback is preferred; switch viewers if one is blank.">
      <View style={styles.form}>
        <Field
          label="URL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/article"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void load(url)}
          returnKeyType="go"
        />
        <Btn label="Fetch archived copy" onPress={() => void load(url)} busy={busy} disabled={!url.trim()} />
        <ErrorText message={error} />
      </View>

      {busy && !document ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingLabel}>Fetching archived page…</Text>
        </View>
      ) : null}

      {document ? (
        <View style={[styles.reader, desktop && styles.readerDesktop]}>
          <Text style={styles.readerTitle}>{document.title || document.canonicalUrl}</Text>
          <Text style={styles.readerMeta}>
            Text via {sourceLabel(document.source)}
            {activeView ? ` · page via ${activeView.label}` : ''} · {new Date(document.fetchedAt).toLocaleString()}
          </Text>
          <View style={styles.modeRow}>
            <Pill label="Page" active={viewMode === 'page'} onPress={() => setViewMode('page')} />
            <Pill label="Text" active={viewMode === 'text'} onPress={() => setViewMode('text')} />
          </View>

          {viewMode === 'page' && views.length > 0 ? (
            <View style={styles.modeRow}>
              {views.map((view) => (
                <Pill
                  key={view.id}
                  label={view.label}
                  active={activeView?.id === view.id}
                  onPress={() => setViewerId(view.id)}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Btn label="Open original" variant="secondary" onPress={() => void Linking.openURL(document.url)} />
            {activeView ? (
              <Btn label="Open archive" variant="ghost" onPress={() => void Linking.openURL(activeView.url)} />
            ) : (
              <Btn label="Open archive source" variant="ghost" onPress={() => void Linking.openURL(document.sourceUrl)} />
            )}
          </View>

          {viewMode === 'page' ? (
            activeView ? (
              <ArchivePageFrame
                key={activeView.url}
                uri={activeView.url}
                title={document.title || 'Archived page'}
                tall={desktop}
              />
            ) : (
              <View style={styles.missingPage}>
                <Text style={styles.missingPageText}>
                  No archived page snapshot is available to embed. Switch to Text, or open the original URL.
                </Text>
              </View>
            )
          ) : (
            <Text style={styles.readerBody} selectable>
              {document.text}
            </Text>
          )}
        </View>
      ) : null}
    </StashChrome>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, marginBottom: space.md },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: space.md,
  },
  loadingLabel: { color: colors.textMuted, fontSize: 14 },
  reader: {
    gap: 12,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readerDesktop: {
    maxWidth: 960,
    padding: space.lg,
  },
  readerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  readerMeta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readerBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    marginTop: space.sm,
  },
  missingPage: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  missingPageText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
