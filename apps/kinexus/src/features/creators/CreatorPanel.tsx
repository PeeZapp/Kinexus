import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  creatorLinksToVerify,
  creatorPlatformLabel,
  creatorQuestionnaireError,
  creatorStatusLabel,
  emptyCreatorQuestionnaire,
  extractCreatorHandleFromUrl,
  isCreatorPlatform,
  normalizeRequestedUsername,
  suggestRequestedCreatorHandle,
  type CreatorPlatform,
  type CreatorQuestionnaire,
} from '@kinexus/domain';

import { useCreator } from '@/src/features/creators/use-creator';
import { Btn, Card, ErrorText, Field } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { verifyCreatorLinks } from '@/src/lib/meals-api';

const PLATFORMS: CreatorPlatform[] = ['instagram', 'youtube', 'tiktok'];

export function CreatorPanel() {
  const { user } = useAuth();
  const creator = useCreator();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreatorQuestionnaire>(() =>
    emptyCreatorQuestionnaire(user?.displayName ?? ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const autoHandleRef = useRef<string>('');

  useEffect(() => {
    if (user?.displayName && !form.displayName) {
      setForm((current) => ({ ...current, displayName: user.displayName }));
    }
  }, [user?.displayName, form.displayName]);

  function patch(update: Partial<CreatorQuestionnaire>) {
    setForm((current) => {
      const next = { ...current, ...update };
      const socialChanged =
        update.instagramUrl !== undefined ||
        update.youtubeUrl !== undefined ||
        update.tiktokUrl !== undefined;

      if (socialChanged) {
        const suggestion = suggestRequestedCreatorHandle(next);
        const currentNormalized = normalizeRequestedUsername(current.requestedUsername);
        const shouldFill =
          !currentNormalized ||
          currentNormalized === autoHandleRef.current ||
          (suggestion && currentNormalized === suggestion.username);

        if (suggestion && shouldFill) {
          autoHandleRef.current = suggestion.username;
          next.requestedUsername = suggestion.username;
          if (!next.requestedPlatform) next.requestedPlatform = suggestion.platform;
        }
      }

      if (update.requestedPlatform && isCreatorPlatform(update.requestedPlatform)) {
        const url =
          update.requestedPlatform === 'instagram'
            ? next.instagramUrl
            : update.requestedPlatform === 'youtube'
              ? next.youtubeUrl
              : next.tiktokUrl;
        const extracted = extractCreatorHandleFromUrl(url, update.requestedPlatform);
        if (extracted) {
          const currentNormalized = normalizeRequestedUsername(next.requestedUsername);
          if (!currentNormalized || currentNormalized === autoHandleRef.current) {
            autoHandleRef.current = extracted;
            next.requestedUsername = extracted;
          }
        }
      }

      if (update.requestedUsername !== undefined) {
        next.requestedUsername = normalizeRequestedUsername(update.requestedUsername);
      }

      return next;
    });
  }

  async function onSubmit() {
    setError(null);
    const validation = creatorQuestionnaireError(form);
    if (validation) {
      setError(validation);
      return;
    }
    const links = creatorLinksToVerify(form);
    setCheckingLinks(true);
    try {
      await verifyCreatorLinks(links);
      await creator.submitApplication({ ...form, valuePitch: '' });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setCheckingLinks(false);
    }
  }

  if (!creator.online) {
    return (
      <Card>
        <Text style={styles.heading}>Become a creator</Text>
        <Text style={styles.body}>
          Sign in with a live account to apply. Approved creators can publish content to the shared
          library for every household.
        </Text>
      </Card>
    );
  }

  if (creator.isLoading) {
    return (
      <Card>
        <Text style={styles.heading}>Become a creator</Text>
        <Text style={styles.body}>Checking creator status…</Text>
      </Card>
    );
  }

  if (creator.isApprovedCreator && creator.creator) {
    return (
      <Card>
        <Text style={styles.heading}>Creator</Text>
        <Text style={styles.status}>{creatorStatusLabel('approved')}</Text>
        {creator.creator.verifiedHandle ? (
          <Text style={styles.verified}>
            @{creator.creator.verifiedHandle}
            {creator.creator.verifiedPlatform
              ? ` · ${creatorPlatformLabel(creator.creator.verifiedPlatform)}`
              : ''}{' '}
            ✓
          </Text>
        ) : null}
        <Text style={styles.body}>
          You publish as {creator.creator.displayName}. Open a household recipe and choose Publish to
          library to share it with everyone.
        </Text>
      </Card>
    );
  }

  if (creator.pendingApplication) {
    return (
      <Card>
        <Text style={styles.heading}>Creator application</Text>
        <Text style={styles.status}>{creatorStatusLabel('pending')}</Text>
        {creator.pendingApplication.requestedUsername ? (
          <Text style={styles.body}>
            Requested @{creator.pendingApplication.requestedUsername}
            {creator.pendingApplication.requestedPlatform
              ? ` on ${creatorPlatformLabel(creator.pendingApplication.requestedPlatform)}`
              : ''}
            . That name is reserved while we review.
          </Text>
        ) : null}
        <Text style={styles.body}>
          Thanks — we review applications manually and may message you on the social profile you
          shared for confirmation. This can take up to 30 days.
        </Text>
      </Card>
    );
  }

  const latest = creator.latestApplication;
  const rejectedOrRevoked =
    latest && (latest.status === 'rejected' || latest.status === 'revoked') ? latest : null;
  const submittedToday = Boolean(
    latest && new Date(latest.createdAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  return (
    <Card>
      <Text style={styles.heading}>Become a creator</Text>
      <Text style={styles.body}>
        Apply to publish into the global library. We review every application, and we may DM you on
        a social profile you provide to confirm it is really you. Reviews can take up to 30 days.
        You can submit one application per day.
      </Text>
      {rejectedOrRevoked ? (
        <View style={styles.banner}>
          <Text style={styles.status}>{creatorStatusLabel(rejectedOrRevoked.status)}</Text>
          {rejectedOrRevoked.staffNotes ? (
            <Text style={styles.body}>{rejectedOrRevoked.staffNotes}</Text>
          ) : null}
          {creator.creator?.revokedReason ? (
            <Text style={styles.body}>{creator.creator.revokedReason}</Text>
          ) : null}
        </View>
      ) : null}
      {submittedToday && !open ? (
        <Text style={styles.body}>
          You already submitted an application today. You can try again tomorrow.
        </Text>
      ) : null}
      {!open ? (
        <Btn
          label={rejectedOrRevoked && !submittedToday ? 'Apply again' : 'Start application'}
          onPress={() => setOpen(true)}
          disabled={submittedToday}
        />
      ) : (
        <View style={styles.form}>
          <Field
            label="Creator name"
            value={form.displayName}
            onChangeText={(displayName) => patch({ displayName })}
            autoCapitalize="words"
            placeholder="Name shown on your creator content"
          />
          <Field
            label="About you"
            value={form.bio}
            onChangeText={(bio) => patch({ bio })}
            multiline
            placeholder="Tell us about you"
          />
          <Field
            label="What qualifies you"
            value={form.expertise}
            onChangeText={(expertise) => patch({ expertise })}
            multiline
            placeholder="Tell us what qualifies you to be a creator"
          />
          <Text style={styles.section}>Socials (at least one required)</Text>
          <Field
            label="Instagram"
            value={form.instagramUrl}
            onChangeText={(instagramUrl) => patch({ instagramUrl })}
            placeholder="https://instagram.com/…"
            autoCapitalize="none"
          />
          <Field
            label="YouTube"
            value={form.youtubeUrl}
            onChangeText={(youtubeUrl) => patch({ youtubeUrl })}
            placeholder="https://youtube.com/…"
            autoCapitalize="none"
          />
          <Field
            label="TikTok"
            value={form.tiktokUrl}
            onChangeText={(tiktokUrl) => patch({ tiktokUrl })}
            placeholder="https://tiktok.com/…"
            autoCapitalize="none"
          />
          <Text style={styles.section}>Requested username</Text>
          <View style={styles.platformRow}>
            {PLATFORMS.map((platform) => {
              const active = form.requestedPlatform === platform;
              return (
                <Pressable
                  key={platform}
                  onPress={() => patch({ requestedPlatform: platform })}
                  style={[styles.platformChip, active && styles.platformChipOn]}>
                  <Text style={[styles.platformChipLabel, active && styles.platformChipLabelOn]}>
                    {creatorPlatformLabel(platform)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Field
            label="Username"
            value={form.requestedUsername}
            onChangeText={(requestedUsername) => patch({ requestedUsername })}
            placeholder="Reserved while we review"
            autoCapitalize="none"
          />
          <Text style={styles.section}>Other links (optional)</Text>
          <Field
            label="Website"
            value={form.websiteUrl}
            onChangeText={(websiteUrl) => patch({ websiteUrl })}
            placeholder="https://"
            autoCapitalize="none"
          />
          <Field
            label="Portfolio"
            value={form.portfolioUrl}
            onChangeText={(portfolioUrl) => patch({ portfolioUrl })}
            placeholder="https://"
            autoCapitalize="none"
          />
          <Field
            label="Other links"
            value={form.otherLinks}
            onChangeText={(otherLinks) => patch({ otherLinks })}
            multiline
            placeholder="Any other public links"
          />
          <Pressable
            onPress={() => patch({ originalityAttested: !form.originalityAttested })}
            style={styles.checkRow}>
            <View style={[styles.check, form.originalityAttested && styles.checkOn]}>
              {form.originalityAttested ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>
              I attest my content is original or that I have the rights to share it globally.
            </Text>
          </Pressable>
          <ErrorText message={error} />
          <View style={styles.actions}>
            <Btn label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
            <Btn
              label="Submit application"
              onPress={() => void onSubmit()}
              busy={creator.submitting || checkingLinks}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  verified: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  status: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  banner: {
    backgroundColor: colors.bgHover,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: 12,
  },
  form: {
    gap: 4,
  },
  section: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  platformChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgElevated,
  },
  platformChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  platformChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  platformChipLabelOn: {
    color: colors.accent,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  checkMark: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
});
