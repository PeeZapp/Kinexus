import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  creatorPlatformLabel,
  creatorReviewChecklistError,
  creatorStatusLabel,
  isCreatorPlatform,
  type CreatorApplication,
} from '@kinexus/domain';

import { Btn, ErrorText } from '@/src/features/household/ui';
import { useStaffDashboard } from '@/src/features/staff/use-staff';
import { colors, radius, space } from '@/src/features/shell/theme';

function LinkRow({ label, href }: { label: string; href: string }) {
  if (!href.trim()) return null;
  return (
    <Pressable onPress={() => void Linking.openURL(href.startsWith('http') ? href : `https://${href}`)}>
      <Text style={styles.link}>
        {label}: {href}
      </Text>
    </Pressable>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow}>
      <View style={[styles.check, checked && styles.checkOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function ApplicationCard({
  app,
  onReview,
  busy,
}: {
  app: CreatorApplication;
  onReview: (input: {
    action: 'approve' | 'reject';
    notes: string;
    contactedViaDm: boolean;
    creatorConfirmed: boolean;
  }) => Promise<void>;
  busy: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [contactedViaDm, setContactedViaDm] = useState(false);
  const [creatorConfirmed, setCreatorConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const platformLabel = isCreatorPlatform(app.requestedPlatform)
    ? creatorPlatformLabel(app.requestedPlatform)
    : 'social';

  async function run(action: 'approve' | 'reject') {
    setError(null);
    const checklistError = creatorReviewChecklistError(
      { contactedViaDm, creatorConfirmed, notes },
      action,
    );
    if (checklistError) {
      setError(checklistError);
      return;
    }
    try {
      await onReview({ action, notes, contactedViaDm, creatorConfirmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{app.displayName}</Text>
        <Text style={styles.badge}>{creatorStatusLabel(app.status)}</Text>
      </View>
      <Text style={styles.meta}>Submitted {new Date(app.createdAt).toLocaleString()}</Text>
      {app.requestedUsername ? (
        <Text style={styles.body}>
          Requested @{app.requestedUsername}
          {isCreatorPlatform(app.requestedPlatform) ? ` · ${platformLabel}` : ''}
        </Text>
      ) : null}
      <Text style={styles.section}>About</Text>
      <Text style={styles.body}>{app.bio}</Text>
      <Text style={styles.section}>What qualifies them</Text>
      <Text style={styles.body}>{app.expertise}</Text>
      <Text style={styles.section}>Links</Text>
      <LinkRow label="Website" href={app.websiteUrl} />
      <LinkRow label="Portfolio" href={app.portfolioUrl} />
      <LinkRow label="Instagram" href={app.instagramUrl} />
      <LinkRow label="YouTube" href={app.youtubeUrl} />
      <LinkRow label="TikTok" href={app.tiktokUrl} />
      {app.otherLinks.trim() ? <Text style={styles.body}>{app.otherLinks}</Text> : null}
      <Text style={styles.meta}>
        Originality attested: {app.originalityAttested ? 'Yes' : 'No'}
      </Text>
      {app.status === 'pending' ? (
        <View style={styles.reviewBox}>
          <Text style={styles.section}>Verification</Text>
          <CheckRow
            label={`Contacted via ${platformLabel} DM`}
            checked={contactedViaDm}
            onToggle={() => setContactedViaDm((value) => !value)}
          />
          <CheckRow
            label="Creator confirmed from that account"
            checked={creatorConfirmed}
            onToggle={() => setCreatorConfirmed((value) => !value)}
          />
          <Text style={styles.section}>Staff notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes for the applicant"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            multiline
          />
          <ErrorText message={error} />
          <View style={styles.row}>
            <Btn label="Reject" variant="danger" busy={busy} onPress={() => void run('reject')} />
            <Btn label="Approve" busy={busy} onPress={() => void run('approve')} />
          </View>
        </View>
      ) : (
        <View style={styles.reviewBox}>
          {app.staffNotes ? <Text style={styles.meta}>Notes: {app.staffNotes}</Text> : null}
          {app.verifiedAt ? (
            <Text style={styles.meta}>
              Verified {new Date(app.verifiedAt).toLocaleString()}
              {app.contactedViaDm || app.creatorConfirmed
                ? ` · DM ${app.contactedViaDm ? 'yes' : 'no'} · confirmed ${app.creatorConfirmed ? 'yes' : 'no'}`
                : ''}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function StaffDigestPage() {
  const staff = useStaffDashboard();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Today’s creator content</Text>
      <Text style={styles.lede}>
        New recipes (and later workouts) published by approved creators on {staff.day} UTC. No
        per-item approval — this digest is your daily review surface.
      </Text>
      {staff.digestLoading ? <Text style={styles.meta}>Loading digest…</Text> : null}
      {!staff.digestLoading && staff.digest.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Quiet day</Text>
          <Text style={styles.body}>No creator content landed today. Check back after chefs publish.</Text>
        </View>
      ) : null}
      {staff.digest.map((item) => (
        <View key={item.eventId} style={styles.card}>
          <Text style={styles.badge}>{item.kind}</Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.creatorDisplayName} · {new Date(item.publishedAt).toLocaleTimeString()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

export function StaffApplicationsPage() {
  const staff = useStaffDashboard();
  const pending = staff.applications.filter((a) => a.status === 'pending');
  const rest = staff.applications.filter((a) => a.status !== 'pending');

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Applications</Text>
      <Text style={styles.lede}>
        Review questionnaire answers and social proof before granting global publish rights.
      </Text>
      {staff.applicationsLoading ? <Text style={styles.meta}>Loading…</Text> : null}
      {pending.length === 0 && !staff.applicationsLoading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Inbox clear</Text>
          <Text style={styles.body}>No pending creator applications.</Text>
        </View>
      ) : null}
      {pending.map((app) => (
        <ApplicationCard
          key={app.id}
          app={app}
          busy={staff.reviewing}
          onReview={({ action, notes, contactedViaDm, creatorConfirmed }) =>
            staff.reviewApplication({
              applicationId: app.id,
              action,
              notes,
              contactedViaDm,
              creatorConfirmed,
            })
          }
        />
      ))}
      {rest.length ? <Text style={styles.subheading}>History</Text> : null}
      {rest.map((app) => (
        <ApplicationCard
          key={app.id}
          app={app}
          busy={false}
          onReview={async () => undefined}
        />
      ))}
    </ScrollView>
  );
}

export function StaffCreatorsPage() {
  const staff = useStaffDashboard();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Creators</Text>
      <Text style={styles.lede}>
        Approved creators can publish recipes live. Revoke access if quality or trust drops — existing
        library recipes stay until you soft-remove them.
      </Text>
      <ErrorText message={error} />
      {staff.creatorsLoading ? <Text style={styles.meta}>Loading…</Text> : null}
      {staff.creators.map((creator) => (
        <View key={creator.userId} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{creator.displayName}</Text>
            <Text style={styles.badge}>{creatorStatusLabel(creator.status)}</Text>
          </View>
          {creator.verifiedHandle ? (
            <Text style={styles.body}>
              @{creator.verifiedHandle}
              {creator.verifiedPlatform ? ` · ${creatorPlatformLabel(creator.verifiedPlatform)}` : ''}{' '}
              ✓
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {creator.approvedAt ? `Approved ${new Date(creator.approvedAt).toLocaleDateString()}` : ''}
            {creator.revokedAt ? ` · Revoked ${new Date(creator.revokedAt).toLocaleDateString()}` : ''}
          </Text>
          {creator.revokedReason ? <Text style={styles.body}>{creator.revokedReason}</Text> : null}
          {creator.status === 'approved' ? (
            <View style={styles.reviewBox}>
              <TextInput
                value={reasons[creator.userId] ?? ''}
                onChangeText={(value) => setReasons((prev) => ({ ...prev, [creator.userId]: value }))}
                placeholder="Reason for revoke"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <Btn
                label="Revoke creator"
                variant="danger"
                busy={staff.revokingCreator}
                onPress={() => {
                  setError(null);
                  void staff
                    .revokeCreator({ userId: creator.userId, reason: reasons[creator.userId] })
                    .catch((err) => setError(err instanceof Error ? err.message : 'Revoke failed'));
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

export function StaffTeamPage() {
  const staff = useStaffDashboard();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Team</Text>
      <Text style={styles.lede}>
        Invite staff by the Google email they will sign in with. Invites unlock the /staff dashboard
        after claim.
      </Text>
      <View style={styles.card}>
        <Text style={styles.section}>Invite staff</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@company.com"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          style={styles.input}
        />
        <ErrorText message={error} />
        <Btn
          label="Send invite"
          busy={staff.invitingStaff}
          disabled={!email.trim()}
          onPress={() => {
            setError(null);
            void staff
              .inviteStaff(email)
              .then(() => setEmail(''))
              .catch((err) => setError(err instanceof Error ? err.message : 'Invite failed'));
          }}
        />
      </View>
      <Text style={styles.subheading}>Staff</Text>
      {staff.team.staff.map((member) => (
        <View key={member.userId} style={styles.card}>
          <Text style={styles.cardTitle}>{member.displayName ?? member.email ?? member.userId}</Text>
          <Text style={styles.meta}>{member.email}</Text>
          <Btn
            label="Remove staff"
            variant="ghost"
            busy={staff.revokingStaff}
            onPress={() => {
              setError(null);
              void staff
                .revokeStaff(member.userId)
                .catch((err) => setError(err instanceof Error ? err.message : 'Remove failed'));
            }}
          />
        </View>
      ))}
      <Text style={styles.subheading}>Open invites</Text>
      {staff.team.invites.filter((i) => !i.accepted_at).map((invite) => (
        <View key={invite.email} style={styles.card}>
          <Text style={styles.cardTitle}>{invite.email}</Text>
          <Text style={styles.meta}>Invited {new Date(invite.created_at).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingBottom: 48,
    gap: 14,
    maxWidth: 880,
  },
  heading: {
    color: '#F4F7FA',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subheading: {
    color: '#F4F7FA',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  lede: {
    color: '#8D9AAB',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#101820',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: space.lg,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  cardTitle: {
    color: '#F4F7FA',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    color: '#3ECFBF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  section: {
    color: '#C5D0DC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    color: '#A8B4C3',
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: '#647084',
    fontSize: 12,
  },
  link: {
    color: '#7DD3C7',
    fontSize: 13,
    marginBottom: 2,
  },
  reviewBox: {
    marginTop: 8,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#0B1219',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: 'rgba(62,207,191,0.16)',
    borderColor: '#3ECFBF',
  },
  checkMark: {
    color: '#3ECFBF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    color: '#A8B4C3',
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#0B1219',
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  empty: {
    paddingVertical: 48,
    paddingHorizontal: 8,
  },
  emptyTitle: {
    color: '#F4F7FA',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});
