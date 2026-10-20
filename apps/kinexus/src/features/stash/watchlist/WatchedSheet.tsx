import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  familyReviewAverage,
  mediaTypeLabel,
  tmdbImageUrl,
  type WatchedScope,
  type WatchlistReview,
  type WatchlistSearchHit,
} from '@kinexus/domain';

import { Btn, Field, Pill } from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius } from '@/src/features/shell/theme';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function WatchedSheet({
  visible,
  hit,
  savedScope,
  savedItemId,
  initialScope,
  myReview,
  otherScores,
  onClose,
  onSave,
  onRemove,
  busy,
  error,
}: {
  visible: boolean;
  hit: WatchlistSearchHit | null;
  savedScope: WatchedScope | null;
  savedItemId: string | null;
  initialScope: WatchedScope;
  myReview: WatchlistReview | null;
  otherScores: readonly number[];
  onClose: () => void;
  onSave: (
    scope: WatchedScope,
    review: { score: number | null; body: string },
    opts: { showOnProfile: boolean },
  ) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const [scope, setScope] = useState<WatchedScope>(initialScope);
  const [score, setScore] = useState<number | null>(myReview?.score ?? null);
  const [body, setBody] = useState(myReview?.body ?? '');
  const [showOnProfile, setShowOnProfile] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setScope(initialScope);
    setScore(myReview?.score ?? null);
    setBody(myReview?.body ?? '');
    setShowOnProfile(true);
  }, [hit?.mediaType, hit?.tmdbId, initialScope, myReview?.body, myReview?.score, myReview?.updatedAt, visible]);

  if (!hit) return null;
  const poster = tmdbImageUrl(hit.posterPath, 'w185');
  const previewScores = score == null ? otherScores : [...otherScores, score];
  const average = scope === 'family' ? familyReviewAverage(previewScores) : null;
  const movingOffFamily = savedScope === 'family' && scope === 'private';
  const sharing = savedScope === 'private' && scope === 'family';

  return (
    <Sheet visible={visible} title={savedItemId ? 'Watched' : 'Add to watched'} onClose={onClose}>
      <View style={styles.stack}>
        <View style={styles.hero}>
          {poster ? <Image source={{ uri: poster }} style={styles.poster} /> : <View style={styles.poster} />}
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{hit.title}</Text>
            <Text style={styles.hint}>
              {hit.year ? `${hit.year} · ` : ''}
              {mediaTypeLabel(hit.mediaType)}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Save to</Text>
        <View style={styles.choices}>
          <Choice
            title="Private"
            body="Only you"
            active={scope === 'private'}
            onPress={() => setScope('private')}
          />
          <Choice
            title="Family"
            body="Shared"
            active={scope === 'family'}
            onPress={() => setScope('family')}
          />
        </View>
        {movingOffFamily ? <Text style={styles.hint}>Only you will see this. It leaves the family list.</Text> : null}
        {sharing ? <Text style={styles.hint}>The family can see this and add their own scores.</Text> : null}
        {average != null ? <Text style={styles.average}>Family score {average}</Text> : null}

        <Text style={styles.label}>Review · optional</Text>
        <View style={styles.scores}>
          {SCORES.map((value) => {
            const on = score === value;
            return (
              <Pressable
                key={value}
                onPress={() => setScore((current) => (current === value ? null : value))}
                style={[styles.score, on && styles.scoreOn]}>
                <Text style={[styles.scoreText, on && styles.scoreTextOn]}>{value}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label="Note"
          value={body}
          onChangeText={setBody}
          placeholder="What did you think?"
          multiline
          autoCapitalize="sentences"
          autoCorrect
        />

        <Text style={styles.label}>Public profile</Text>
        <View style={styles.choices}>
          <Pill label="Show on my profile" active={showOnProfile} onPress={() => setShowOnProfile(true)} />
          <Pill label="Keep private" active={!showOnProfile} onPress={() => setShowOnProfile(false)} />
        </View>
        <Text style={styles.hint}>
          Profile titles appear under your funny name for everyone. Real names stay hidden.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Btn label="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
          </View>
          <View style={styles.action}>
            <Btn
              label={savedItemId ? 'Save' : scope === 'family' ? 'Add to family' : 'Add to private'}
              onPress={() => void onSave(scope, { score, body }, { showOnProfile })}
              busy={busy}
              disabled={busy}
            />
          </View>
        </View>
        {savedItemId ? (
          <Btn
            label={savedScope === 'family' ? 'Remove from family' : 'Remove from private'}
            variant="ghost"
            onPress={() => void onRemove(savedItemId)}
            disabled={busy}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function Choice({
  title,
  body,
  active,
  onPress,
}: {
  title: string;
  body: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceOn]}>
      <Text style={[styles.choiceTitle, active && styles.choiceTitleOn]}>{title}</Text>
      <Text style={styles.choiceBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 8 },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  poster: { width: 54, height: 80, borderRadius: radius.sm, backgroundColor: colors.bgHover },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  choiceOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  choiceTitleOn: { color: colors.accent },
  choiceBody: { color: colors.textMuted, fontSize: 13 },
  average: { color: colors.text, fontSize: 15, fontWeight: '800' },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  score: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  scoreText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  scoreTextOn: { color: colors.bg },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
