import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { BookSearchHit, HouseholdPerson } from '@kinexus/domain';

import { Btn, Field } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { resolveBookUrl, searchBooks } from '@/src/features/readlist/readlist-api';
import { shouldResolveBookQuery } from '@/src/features/readlist/readlist-model';
import { ReadlistSearch, ScoreRail } from '@/src/features/readlist/ReadlistShared';
import { readlistActionError } from '@/src/features/readlist/use-readlist-sync';
import type { LinkShareState } from '@/src/features/share/LinkShareSheet';
import { SharePicker } from '@/src/features/stash/sheets';
import type { ListShareDraft } from '@/src/features/stash/use-stash-sync';
import { colors, radius, space } from '@/src/features/shell/theme';
import { StashPhoto } from '@/src/features/stash/StashShared';

export function AddReadlistSheet({
  visible,
  people,
  onClose,
  onSave,
  busy,
  error,
}: {
  visible: boolean;
  people: HouseholdPerson[];
  onClose: () => void;
  onSave: (name: string, share: ListShareDraft) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState('');
  const [share, setShare] = useState<ListShareDraft>({ visibility: 'household', personIds: [] });
  useEffect(() => {
    if (!visible) return;
    setName('');
    setShare({ visibility: 'household', personIds: [] });
  }, [visible]);
  return (
    <Sheet visible={visible} title="New readlist" onClose={onClose}>
      <View style={styles.stack}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Book club, kids books…"
          autoCapitalize="words"
        />
        <SharePicker share={share} onChange={setShare} people={people} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Create list"
          onPress={() => void onSave(name, share)}
          busy={busy}
          disabled={!name.trim() || (share.visibility === 'people' && share.personIds.length === 0)}
        />
      </View>
    </Sheet>
  );
}

export function ReadlistSettingsSheet({
  visible,
  name,
  onNameChange,
  preview,
  share,
  onShareChange,
  people,
  linkState,
  linkBusy,
  linkError,
  canDelete,
  deleteLabel = 'Delete list',
  onClose,
  onSave,
  onDelete,
  onToggleLink,
  onResetLink,
  busy,
  error,
}: {
  visible: boolean;
  name: string;
  onNameChange: (value: string) => void;
  preview: string;
  share: ListShareDraft;
  onShareChange: (share: ListShareDraft) => void;
  people: HouseholdPerson[];
  linkState: LinkShareState;
  linkBusy?: boolean;
  linkError?: string | null;
  canDelete?: boolean;
  deleteLabel?: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onToggleLink: (enabled: boolean) => Promise<string | null>;
  onResetLink: () => Promise<string | null>;
  busy?: boolean;
  error?: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const working = Boolean(busy || linkBusy || localBusy);
  const url = linkState.url;

  useEffect(() => {
    if (!visible) return;
    setStatus(null);
  }, [visible]);

  async function run(action: () => Promise<string | null>, okMessage: string) {
    if (working) return;
    setLocalBusy(true);
    setStatus(null);
    try {
      const nextUrl = await action();
      if (nextUrl) {
        await Clipboard.setStringAsync(nextUrl);
        setStatus(okMessage);
      } else {
        setStatus(null);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update share link');
    } finally {
      setLocalBusy(false);
    }
  }

  async function nativeShare() {
    if (!url || working) return;
    setLocalBusy(true);
    setStatus(null);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: preview, text: preview, url });
      } else {
        await Share.share({ message: `${preview}\n${url}`, url, title: preview });
      }
    } catch {
      // user cancelled
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="List settings" onClose={onClose}>
      <View style={styles.stack}>
        <Field label="Name" value={name} onChangeText={onNameChange} />
        <SharePicker share={share} onChange={onShareChange} people={people} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Btn
          label="Save"
          onPress={() => void onSave()}
          busy={working}
          disabled={!name.trim() || (share.visibility === 'people' && share.personIds.length === 0)}
        />

        <Text style={styles.preview}>{preview}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: linkState.isShared }}
          disabled={working}
          onPress={() =>
            void run(
              () => onToggleLink(!linkState.isShared),
              linkState.isShared ? 'Sharing off' : 'Link copied',
            )
          }
          style={[styles.toggle, linkState.isShared && styles.toggleOn]}>
          <View style={[styles.knob, linkState.isShared && styles.knobOn]} />
          <Text style={[styles.toggleLabel, linkState.isShared && styles.toggleLabelOn]}>
            Anyone with the link can view
          </Text>
        </Pressable>
        {url ? (
          <Text style={styles.url} numberOfLines={2}>
            {url}
          </Text>
        ) : null}
        {linkError ? <Text style={styles.error}>{linkError}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <Btn
          label="Copy link"
          variant="secondary"
          disabled={!linkState.isShared || !url || working}
          busy={working}
          onPress={() => {
            if (!url) return;
            void Clipboard.setStringAsync(url).then(() => setStatus('Link copied'));
          }}
        />
        <Btn label="Share" disabled={!linkState.isShared || !url || working} onPress={() => void nativeShare()} />
        <Btn
          label="Reset link"
          variant="ghost"
          disabled={!linkState.isShared || working}
          onPress={() => void run(() => onResetLink(), 'New link copied — old link revoked')}
        />
        {canDelete && onDelete ? (
          <Btn label={deleteLabel} variant="danger" disabled={working} onPress={() => void onDelete()} />
        ) : null}
      </View>
    </Sheet>
  );
}

export function AddAlreadyReadSheet({
  visible,
  online,
  busy,
  error,
  onClose,
  onAdd,
}: {
  visible: boolean;
  online: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onAdd: (hit: BookSearchHit, score: number | null) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<BookSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<BookSearchHit | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setHits([]);
    setSearching(false);
    setMessage(null);
    setPicked(null);
    setScore(null);
  }, [visible]);

  useEffect(() => {
    if (!visible || picked) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setMessage(null);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    setMessage(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const next = shouldResolveBookQuery(trimmed)
            ? await resolveBookUrl(trimmed)
            : await searchBooks(trimmed);
          if (seq !== searchSeq.current) return;
          setHits(next);
          setMessage(next.length === 0 ? 'No books found.' : null);
        } catch (err) {
          if (seq !== searchSeq.current) return;
          setHits([]);
          setMessage(readlistActionError(err, 'Search failed'));
        } finally {
          if (seq === searchSeq.current) setSearching(false);
        }
      })();
    }, 280);
    return () => clearTimeout(timer);
  }, [picked, query, visible]);

  return (
    <Sheet visible={visible} title="I've read" onClose={onClose} wide>
      <View style={styles.stack}>
        {picked ? (
          <>
            <View style={styles.picked}>
              <StashPhoto uri={picked.coverUrl} fallback="📖" size={64} />
              <View style={styles.pickedCopy}>
                <Text style={styles.pickedTitle}>{picked.title}</Text>
                <Text style={styles.pickedMeta} numberOfLines={2}>
                  {[picked.authors.join(', '), picked.firstPublishedYear].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <Text style={styles.scoreLabel}>Score</Text>
            <ScoreRail value={score} onChange={setScore} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Btn
              label="Add to Already read"
              onPress={() => void onAdd(picked, score)}
              busy={busy}
              disabled={!online}
            />
            <Btn
              label="Back to search"
              variant="ghost"
              onPress={() => {
                setPicked(null);
                setScore(null);
              }}
              disabled={busy}
            />
          </>
        ) : (
          <ReadlistSearch
            query={query}
            setQuery={setQuery}
            hits={hits}
            searching={searching}
            message={message}
            hitOnList={() => false}
            addingWorkId={null}
            onPick={(hit) => setPicked(hit)}
            online={online && !busy}
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  picked: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pickedCopy: { flex: 1, minWidth: 0, gap: 4 },
  pickedTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  pickedMeta: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  scoreLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  preview: { color: colors.text, fontSize: 16, fontWeight: '700' },
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
  url: { color: colors.textDim, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  status: { color: colors.textMuted, fontSize: 13 },
});
