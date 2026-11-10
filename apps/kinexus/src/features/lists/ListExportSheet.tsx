import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  buildListExport,
  type BuiltExport,
  type ExportListInput,
  type KinexusListKind,
  type ListExportFormat,
} from '@kinexus/domain';

import { Btn, Pill } from '@/src/features/household/ui';
import { shareOrDownloadExport } from '@/src/features/lists/list-file-io';
import { Sheet } from '@/src/features/meals/meals-kit';
import type { LinkShareState } from '@/src/features/share/LinkShareSheet';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useExperienceMode } from '@/src/lib/experience-mode';

const FORMATS: { value: ListExportFormat; label: string; kinds?: KinexusListKind[] }[] = [
  { value: 'json', label: 'Kinexus JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'text', label: 'Plain text' },
  { value: 'letterboxd-csv', label: 'Letterboxd CSV', kinds: ['watchlist'] },
  { value: 'goodreads-csv', label: 'Goodreads CSV', kinds: ['readlist'] },
];

export type ListExportLinkShare = {
  preview: string;
  state: LinkShareState;
  busy?: boolean;
  error?: string | null;
  onToggle: (enabled: boolean) => Promise<string | null>;
  onReset: () => Promise<string | null>;
};

export function ListExportSheet({
  visible,
  input,
  linkShare,
  buildExport,
  onClose,
}: {
  visible: boolean;
  input: ExportListInput | null;
  linkShare?: ListExportLinkShare | null;
  /** Override builder (e.g. readlist Goodreads via API). */
  buildExport?: (format: ListExportFormat) => Promise<BuiltExport>;
  onClose: () => void;
}) {
  useExperienceMode();
  const [mode, setMode] = useState<'link' | 'file'>(linkShare ? 'link' : 'file');
  const [format, setFormat] = useState<ListExportFormat>('json');
  const [moreFormats, setMoreFormats] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isReadlist = input?.kind === 'readlist';

  useEffect(() => {
    if (!visible) return;
    setMode(linkShare ? 'link' : 'file');
    setFormat(isReadlist ? 'goodreads-csv' : 'json');
    setMoreFormats(false);
    setBusy(false);
    setError(null);
    setStatus(null);
  }, [visible, linkShare, isReadlist]);

  async function exportNow(nextFormat: ListExportFormat = format) {
    if (!input || busy) return;
    setBusy(true);
    setError(null);
    try {
      const built = buildExport
        ? await buildExport(nextFormat)
        : buildListExport(input, nextFormat);
      await shareOrDownloadExport(built);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export');
    } finally {
      setBusy(false);
    }
  }

  async function runLink(action: () => Promise<string | null>, okMessage: string) {
    if (!linkShare || busy || linkShare.busy) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const nextUrl = await action();
      if (nextUrl) {
        await Clipboard.setStringAsync(nextUrl);
        setStatus(okMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update share link');
    } finally {
      setBusy(false);
    }
  }

  async function nativeShare() {
    if (!linkShare?.state.url || busy || linkShare.busy) return;
    setBusy(true);
    try {
      const url = linkShare.state.url;
      const preview = linkShare.preview;
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: preview, text: preview, url });
      } else {
        await Share.share({ message: `${preview}\n${url}`, url, title: preview });
      }
    } catch {
      // cancelled
    } finally {
      setBusy(false);
    }
  }

  const working = Boolean(busy || linkShare?.busy);
  const url = linkShare?.state.url ?? null;

  return (
    <Sheet visible={visible} title={input ? `Share ${input.listName}` : 'Share'} onClose={onClose}>
      <View style={styles.stack}>
        {linkShare ? (
          <View style={styles.wrap}>
            <Pill label="Link" active={mode === 'link'} onPress={() => setMode('link')} />
            <Pill label="File" active={mode === 'file'} onPress={() => setMode('file')} />
          </View>
        ) : null}

        {mode === 'link' && linkShare ? (
          <>
            <Text style={styles.preview}>{linkShare.preview}</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: linkShare.state.isShared }}
              disabled={working}
              onPress={() =>
                void runLink(
                  () => linkShare.onToggle(!linkShare.state.isShared),
                  linkShare.state.isShared ? 'Sharing off' : 'Link copied',
                )
              }
              style={[styles.toggle, linkShare.state.isShared && styles.toggleOn]}>
              <View style={[styles.knob, linkShare.state.isShared && styles.knobOn]} />
              <Text style={[styles.toggleLabel, linkShare.state.isShared && styles.toggleLabelOn]}>
                Anyone with the link can view
              </Text>
            </Pressable>
            {url ? (
              <Text style={styles.url} numberOfLines={2}>
                {url}
              </Text>
            ) : null}
            {linkShare.error || error ? <Text style={styles.error}>{linkShare.error ?? error}</Text> : null}
            {status ? <Text style={styles.status}>{status}</Text> : null}
            <Btn
              label="Copy link"
              variant="secondary"
              disabled={!linkShare.state.isShared || !url || working}
              busy={working}
              onPress={() => {
                if (!url) return;
                void Clipboard.setStringAsync(url).then(() => setStatus('Link copied'));
              }}
            />
            <Btn label="Share" disabled={!linkShare.state.isShared || !url || working} onPress={() => void nativeShare()} />
            <Btn
              label="Reset link"
              variant="ghost"
              disabled={!linkShare.state.isShared || working}
              onPress={() => void runLink(() => linkShare.onReset(), 'New link copied — old link revoked')}
            />
          </>
        ) : isReadlist ? (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn
              label={busy ? 'Exporting…' : 'Export'}
              onPress={() => void exportNow('goodreads-csv')}
              busy={busy}
              disabled={!input}
            />
            <Btn
              label={moreFormats ? 'Hide formats' : 'More formats'}
              variant="ghost"
              onPress={() => setMoreFormats((value) => !value)}
            />
            {moreFormats ? (
              <View style={styles.wrap}>
                <Pill
                  label="JSON"
                  active={format === 'json'}
                  onPress={() => {
                    setFormat('json');
                    void exportNow('json');
                  }}
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.hint}>Choose a format</Text>
            <View style={styles.wrap}>
              {FORMATS.filter((item) => !item.kinds || (input && item.kinds.includes(input.kind))).map((item) => (
                <Pill key={item.value} label={item.label} active={format === item.value} onPress={() => setFormat(item.value)} />
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn label={busy ? 'Exporting…' : 'Export'} onPress={() => void exportNow()} busy={busy} disabled={!input} />
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 14 },
  preview: { color: colors.text, fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14 },
  status: { color: colors.textMuted, fontSize: 13 },
  url: { color: colors.textDim, fontSize: 13 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  knobOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  toggleLabel: { flex: 1, color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  toggleLabelOn: { color: colors.accent },
});
