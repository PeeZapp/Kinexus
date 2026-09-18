import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';

import type { HouseholdInvite, HouseholdMember, HouseholdPerson, HouseholdRole, PersonType } from '@kinexus/domain';
import { GROCERY_MARKETS, marketForHousehold, storeListLabel } from '@kinexus/domain';

import { Btn, Card, ErrorText, Field, Pill } from '@/src/features/household/ui';
import { colors, radius, space } from '@/src/features/shell/theme';
import { parseInviteToken } from '@/src/lib/invite';
import { useHousehold } from '@/src/lib/household';
import { refreshRecipePrices } from '@/src/lib/meals-api';

const PERSON_TYPES: { value: PersonType; label: string }[] = [
  { value: 'adult', label: 'Adult' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other' },
];

const DIETARY_PRESETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher'];

export function CreateJoinPanel() {
  const { createHousehold, acceptInvite } = useHousehold();
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    setBusy('create');
    try {
      await createHousehold({ name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create household');
    } finally {
      setBusy(null);
    }
  }

  async function onJoin() {
    setError(null);
    setBusy('join');
    try {
      await acceptInvite(parseInviteToken(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invite');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Create a household</Text>
      <Text style={styles.body}>A household is the shared space for Meals, Lists, Nutrition, and Train.</Text>
      <Field label="Household name" value={name} onChangeText={setName} placeholder="The Zappas" autoCapitalize="words" />
      <Btn label="Create household" onPress={() => void onCreate()} busy={busy === 'create'} disabled={!name.trim()} />
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>or join with an invite</Text>
        <View style={styles.dividerLine} />
      </View>
      <Field
        label="Invite link or token"
        value={token}
        onChangeText={setToken}
        placeholder="Paste invite URL or token"
      />
      <Btn
        label="Accept invite"
        variant="secondary"
        onPress={() => void onJoin()}
        busy={busy === 'join'}
        disabled={!token.trim()}
      />
      <ErrorText message={error} />
    </Card>
  );
}

export function HouseholdSwitcher() {
  const { memberships, activeHousehold, setActiveHouseholdId, renameHousehold, canManageInvites } = useHousehold();
  const [name, setName] = useState(activeHousehold?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(activeHousehold?.name ?? '');
  }, [activeHousehold?.id, activeHousehold?.name]);

  if (!activeHousehold) return null;

  async function onRename() {
    setError(null);
    setBusy(true);
    try {
      await renameHousehold(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Household</Text>
      {memberships.length > 1 ? (
        <View style={styles.wrapRow}>
          {memberships.map((m) => (
            <Pill
              key={m.household.id}
              label={m.household.name}
              active={m.household.id === activeHousehold.id}
              onPress={() => void setActiveHouseholdId(m.household.id)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.body}>{activeHousehold.name}</Text>
      )}
      {canManageInvites ? (
        <>
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Btn
            label="Save name"
            variant="secondary"
            onPress={() => void onRename()}
            busy={busy}
            disabled={!name.trim() || name.trim() === activeHousehold.name}
          />
        </>
      ) : null}
      <ErrorText message={error} />
    </Card>
  );
}

export function LocationPanel() {
  const { activeHousehold, canManageInvites, updateHouseholdLocation } = useHousehold();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceNote, setPriceNote] = useState<string | null>(null);

  if (!activeHousehold) return null;

  const current = marketForHousehold(activeHousehold);

  async function onSelect(country: string, currency: string) {
    setError(null);
    setBusy(true);
    try {
      await updateHouseholdLocation({ country, currency });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save location');
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshPrices() {
    if (!activeHousehold) return;
    setError(null);
    setPriceNote(null);
    setPricing(true);
    try {
      const result = await refreshRecipePrices(activeHousehold.id);
      await queryClient.invalidateQueries({ queryKey: ['meals', 'recipes'] });
      if (result.processed === 0) {
        setPriceNote('Prices are already current for this month.');
      } else {
        setPriceNote('Updated supermarket prices. Open Recipes to see costs.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update prices');
    } finally {
      setPricing(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>Grocery prices</Text>
      <Text style={styles.body}>
        Recipe costs use typical {storeListLabel(current.stores)} prices in {current.currency}. The ingredient catalog
        refreshes on the first of each month, or tap update below.
      </Text>
      {canManageInvites ? (
        <View style={styles.wrapRow}>
          {GROCERY_MARKETS.map((market) => (
            <Pill
              key={market.country}
              label={market.label}
              active={market.country === current.country}
              onPress={busy ? undefined : () => void onSelect(market.country, market.currency)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.body}>{current.label}</Text>
      )}
      {canManageInvites ? (
        <Btn
          label={pricing ? 'Updating prices…' : 'Update prices now'}
          variant="secondary"
          onPress={() => void onRefreshPrices()}
          busy={pricing}
          disabled={busy}
        />
      ) : null}
      {priceNote ? <Text style={styles.body}>{priceNote}</Text> : null}
      <ErrorText message={error} />
    </Card>
  );
}

export function InvitePanel() {
  const { canManageInvites, createInvite, revokeInvite, invites } = useHousehold();
  const [role, setRole] = useState<Exclude<HouseholdRole, 'owner'>>('member');
  const [created, setCreated] = useState<{ url: string; token: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManageInvites) {
    return (
      <Card>
        <Text style={styles.heading}>Invites</Text>
        <Text style={styles.body}>Only owners and admins can invite people to this household.</Text>
      </Card>
    );
  }

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      const invite = await createInvite(role);
      setCreated({ url: invite.url, token: invite.token, expiresAt: invite.expiresAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invite');
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: 'url' | 'token', value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  }

  const pending = invites.filter((i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > new Date());

  return (
    <Card>
      <Text style={styles.heading}>Invite a member</Text>
      <Text style={styles.body}>
        Creates a one-time link. The raw token is shown once — it is stored hashed, not as a guessable code.
      </Text>
      <View style={styles.wrapRow}>
        <Pill label="Member" active={role === 'member'} onPress={() => setRole('member')} />
        <Pill label="Admin" active={role === 'admin'} onPress={() => setRole('admin')} />
      </View>
      <Btn label="Create invite link" onPress={() => void onCreate()} busy={busy} />
      {created ? (
        <View style={styles.createdBox}>
          <Text style={styles.kicker}>Share this link</Text>
          <Text selectable style={styles.mono}>
            {created.url}
          </Text>
          <Btn
            label={copied === 'url' ? 'Copied link' : 'Copy link'}
            variant="secondary"
            onPress={() => void copy('url', created.url)}
          />
          <Text style={styles.kicker}>Or copy token</Text>
          <Text selectable style={styles.mono}>
            {created.token}
          </Text>
          <Btn
            label={copied === 'token' ? 'Copied token' : 'Copy token'}
            variant="ghost"
            onPress={() => void copy('token', created.token)}
          />
          <Text style={styles.meta}>Expires {new Date(created.expiresAt).toLocaleString()}</Text>
        </View>
      ) : null}
      {pending.length > 0 ? (
        <View style={styles.list}>
          <Text style={styles.kicker}>Pending</Text>
          {pending.map((invite) => (
            <PendingInviteRow key={invite.id} invite={invite} onRevoke={() => void revokeInvite(invite.id)} />
          ))}
        </View>
      ) : null}
      <ErrorText message={error} />
    </Card>
  );
}

function PendingInviteRow({ invite, onRevoke }: { invite: HouseholdInvite; onRevoke: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{invite.role}</Text>
        <Text style={styles.meta}>Expires {new Date(invite.expiresAt).toLocaleString()}</Text>
      </View>
      <Pressable onPress={onRevoke} hitSlop={8}>
        <Text style={styles.dangerLink}>Revoke</Text>
      </Pressable>
    </View>
  );
}

export function MembersList({ members }: { members: HouseholdMember[] }) {
  return (
    <Card>
      <Text style={styles.heading}>Members</Text>
      {members.map((member) => (
        <View key={member.userId} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{member.profile.displayName ?? 'Member'}</Text>
            <Text style={styles.meta}>{member.profile.email ?? member.userId}</Text>
          </View>
          <Text style={styles.roleBadge}>{member.role}</Text>
        </View>
      ))}
    </Card>
  );
}

export function PeoplePanel() {
  const { people, members, addPerson, removePerson, linkPerson, canManageInvites } = useHousehold();
  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('adult');
  const [dietary, setDietary] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDiet(tag: string) {
    setDietary((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function onAdd() {
    setError(null);
    setBusy(true);
    try {
      await addPerson({ name, personType, dietary });
      setName('');
      setPersonType('adult');
      setDietary([]);
      setCustom('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.heading}>People</Text>
      <Text style={styles.body}>
        Family members you plan for. Link a signed-in account so they can pick recipes on slots you assign to them.
      </Text>
      {people.length === 0 ? <Text style={styles.meta}>No people yet.</Text> : null}
      {people.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          members={members}
          people={people}
          canLink={canManageInvites}
          onLink={(userId) => void linkPerson(person.id, userId)}
          onRemove={() => void removePerson(person.id)}
        />
      ))}
      <Field label="Add person" value={name} onChangeText={setName} placeholder="Name" autoCapitalize="words" />
      <View style={styles.wrapRow}>
        {PERSON_TYPES.map((t) => (
          <Pill key={t.value} label={t.label} active={personType === t.value} onPress={() => setPersonType(t.value)} />
        ))}
      </View>
      <View style={styles.wrapRow}>
        {DIETARY_PRESETS.map((tag) => (
          <Pill key={tag} label={tag} active={dietary.includes(tag)} onPress={() => toggleDiet(tag)} />
        ))}
      </View>
      <Field
        label="Custom dietary tag"
        value={custom}
        onChangeText={setCustom}
        placeholder="e.g. soy-free"
        onSubmitEditing={() => {
          const tag = custom.trim().toLowerCase();
          if (tag) {
            setDietary((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
            setCustom('');
          }
        }}
      />
      <Btn label="Add person" variant="secondary" onPress={() => void onAdd()} busy={busy} disabled={!name.trim()} />
      <ErrorText message={error} />
    </Card>
  );
}

function PersonRow({
  person,
  members,
  people,
  canLink,
  onLink,
  onRemove,
}: {
  person: HouseholdPerson;
  members: HouseholdMember[];
  people: HouseholdPerson[];
  canLink: boolean;
  onLink: (userId: string | null) => void;
  onRemove: () => void;
}) {
  const linked = members.find((member) => member.userId === person.userId);
  const available = members.filter(
    (member) => member.userId === person.userId || !people.some((other) => other.userId === member.userId),
  );
  return (
    <View style={styles.personBlock}>
      <View style={styles.personHead}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{person.name}</Text>
          <Text style={styles.meta}>
            {person.personType}
            {person.dietary.length ? ` · ${person.dietary.join(', ')}` : ''}
            {linked ? ` · login: ${linked.profile.displayName ?? linked.profile.email ?? 'linked'}` : ''}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={styles.dangerLink}>Remove</Text>
        </Pressable>
      </View>
      {canLink ? (
        <View style={styles.wrapRow}>
          <Pill label="No login" active={!person.userId} onPress={() => onLink(null)} />
          {available.map((member) => (
            <Pill
              key={member.userId}
              label={member.profile.displayName ?? member.profile.email ?? 'Member'}
              active={person.userId === member.userId}
              onPress={() => onLink(member.userId)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  meta: {
    color: colors.textDim,
    fontSize: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  createdBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: space.sm,
    gap: 8,
  },
  mono: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  roleBadge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  dangerLink: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  personBlock: {
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  personHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
