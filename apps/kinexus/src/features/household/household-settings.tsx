import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  assignableRoles,
  canChangeMemberRole,
  canDeleteHousehold,
  canLeaveHousehold,
  canRemoveMember,
  HOUSEHOLD_EMOJIS,
  inviteRoles,
  normalizeHouseholdEmoji,
  roleLabel,
  type AssignableRole,
  type HouseholdInvite,
  type HouseholdMember,
  type HouseholdPerson,
  type HouseholdRole,
  type PersonType,
} from '@kinexus/domain';

import { BirthdayPicker } from '@/src/features/household/BirthdayPicker';
import { OptionTiles } from '@/src/features/household/option-tiles';
import {
  Btn,
  Card,
  EditIconButton,
  ErrorText,
  Field,
} from '@/src/features/household/ui';
import { Sheet } from '@/src/features/meals/meals-kit';
import { colors, radius, space } from '@/src/features/shell/theme';
import { useAuth } from '@/src/lib/auth';
import { confirmAction } from '@/src/lib/confirm';
import { useExperienceMode } from '@/src/lib/experience-mode';
import { useHousehold } from '@/src/lib/household';

const PERSON_TYPES: { value: PersonType; label: string }[] = [
  { value: 'adult', label: 'Adult' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other' },
];

const DIETARY_PRESETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher'];

type FamilyEntry = {
  key: string;
  person: HouseholdPerson | null;
  member: HouseholdMember | null;
  name: string;
  subtitle: string;
};

function canEditFamilyPeople(role: HouseholdRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'adult';
}

function formatBirthday(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function personTypeLabel(type: PersonType): string {
  return PERSON_TYPES.find((row) => row.value === type)?.label ?? type;
}

function buildFamilyRoster(
  members: HouseholdMember[],
  people: HouseholdPerson[],
  selfId: string | undefined,
  previewRole: HouseholdRole | null,
): FamilyEntry[] {
  const linkedUserIds = new Set(people.map((person) => person.userId).filter(Boolean) as string[]);
  const fromPeople: FamilyEntry[] = people.map((person) => {
    const member = person.userId
      ? members.find((row) => row.userId === person.userId) ?? null
      : null;
    const shownRole =
      member && selfId && member.userId === selfId && previewRole ? previewRole : member?.role;
    const bits = [
      member ? roleLabel(shownRole ?? member.role) : personTypeLabel(person.personType),
      !member ? 'No login' : null,
      formatBirthday(person.birthday),
      person.dietary.length ? person.dietary.join(', ') : null,
    ].filter(Boolean);
    return {
      key: `person:${person.id}`,
      person,
      member,
      name: person.name,
      subtitle: bits.join(' · '),
    };
  });

  const orphanMembers: FamilyEntry[] = members
    .filter((member) => !linkedUserIds.has(member.userId))
    .map((member) => {
      const shownRole =
        selfId && member.userId === selfId && previewRole ? previewRole : member.role;
      const bits = [
        roleLabel(shownRole),
        member.profile.email,
        'Add details',
      ].filter(Boolean);
      return {
        key: `member:${member.userId}`,
        person: null,
        member,
        name: member.profile.displayName ?? 'Member',
        subtitle: bits.join(' · '),
      };
    });

  const rank = (entry: FamilyEntry) => {
    const role = entry.member?.role;
    if (role === 'owner') return 0;
    if (role === 'admin') return 1;
    if (role === 'adult') return 2;
    if (role === 'teen') return 3;
    if (role === 'child') return 4;
    if (entry.person?.personType === 'adult') return 5;
    if (entry.person?.personType === 'child') return 6;
    return 7;
  };

  return [...fromPeople, ...orphanMembers].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

export function HouseholdSettingsSection({ members }: { members: HouseholdMember[] }) {
  const { mode } = useExperienceMode();
  const wide = mode === 'desktop';
  const { user, signOut } = useAuth();
  const {
    role,
    memberships,
    activeHousehold,
    people,
    setActiveHouseholdId,
    canManageHousehold,
    renameHousehold,
    updateHouseholdEmoji,
    leaveHousehold,
    deleteHousehold,
    deleteOwnAccount,
    setMemberRole,
    removeMember,
    addPerson,
    updatePerson,
    linkPerson,
    removePerson,
  } = useHousehold();

  const [nameOpen, setNameOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<FamilyEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roster = useMemo(
    () => buildFamilyRoster(members, people, user?.id, role),
    [members, people, user?.id, role],
  );

  if (!activeHousehold) return null;

  const emoji = normalizeHouseholdEmoji(activeHousehold.emoji);
  const soleOwner = role === 'owner' && members.filter((member) => member.role === 'owner').length <= 1;
  const showLeave = canLeaveHousehold(role, soleOwner);
  const showDelete = canDeleteHousehold(role);
  const canEditPeople = canEditFamilyPeople(role);

  // Keep selected entry fresh after reloads
  const selectedFresh = selected
    ? roster.find((entry) => entry.key === selected.key) ?? selected
    : null;

  async function confirmLeave() {
    const confirmed = await confirmAction(
      'Leave household',
      'You will lose access until someone invites you again.',
    );
    if (!confirmed) return;
    setError(null);
    try {
      await leaveHousehold();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave');
    }
  }

  async function confirmDeleteFamily() {
    const confirmed = await confirmAction(
      'Delete family',
      `Delete ${activeHousehold.name}? Meals, lists, money, and everyone in it are removed. You stay signed in and can start a new family.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await deleteHousehold();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the family');
    }
  }

  async function confirmDeleteAccount() {
    const confirmed = await confirmAction(
      'Delete your account',
      'Your sign-in is removed, and any family you are the only owner of is deleted. This cannot be undone.',
    );
    if (!confirmed) return;
    setError(null);
    try {
      await deleteOwnAccount();
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account');
    }
  }

  const hero = (
    <View style={[styles.hero, wide && styles.heroWide]}>
      <Pressable
        onPress={canManageHousehold ? () => setEmojiOpen(true) : undefined}
        disabled={!canManageHousehold}
        accessibilityRole={canManageHousehold ? 'button' : undefined}
        accessibilityLabel={canManageHousehold ? 'Edit household logo' : 'Household logo'}
        style={styles.emojiTap}>
        <View style={[styles.emojiDisk, wide && styles.emojiDiskWide]}>
          <Text style={[styles.emojiGlyph, wide && styles.emojiGlyphWide]}>{emoji}</Text>
        </View>
        {canManageHousehold ? (
          <View style={styles.emojiEditBadge} pointerEvents="none">
            <Text style={styles.emojiEditGlyph}>✎</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.heroIdentity}>
        <View style={styles.nameRow}>
          {canManageHousehold ? (
            <Pressable
              onPress={() => setNameOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit household name"
              style={styles.namePress}>
              <Text style={[styles.nameHeading, wide && styles.nameHeadingWide]} numberOfLines={1}>
                {activeHousehold.name}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.nameHeading, wide && styles.nameHeadingWide]} numberOfLines={1}>
              {activeHousehold.name}
            </Text>
          )}
          {canManageHousehold ? (
            <EditIconButton label="Edit household name" onPress={() => setNameOpen(true)} />
          ) : null}
        </View>

        {memberships.length > 1 ? (
          <View style={styles.switcher}>
            {memberships.map((membership) => {
              const active = membership.household.id === activeHousehold.id;
              return (
                <Pressable
                  key={membership.household.id}
                  onPress={() => void setActiveHouseholdId(membership.household.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.switchChip, active && styles.switchChipActive]}>
                  <Text style={styles.switchChipEmoji}>
                    {normalizeHouseholdEmoji(membership.household.emoji)}
                  </Text>
                  <Text
                    style={[styles.switchChipLabel, active && styles.switchChipLabelActive]}
                    numberOfLines={1}>
                    {membership.household.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.sectionRoot}>
      <Card>{hero}</Card>

      <Card>
        <Text style={styles.heading}>Family</Text>
        {roster.map((entry) => (
          <Pressable
            key={entry.key}
            onPress={() => setSelected(entry)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${entry.name}`}
            style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}>
            <View style={styles.memberText}>
              <Text style={styles.memberName} numberOfLines={1}>
                {entry.name}
              </Text>
              <Text style={styles.memberMeta} numberOfLines={2}>
                {entry.subtitle}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        {canEditPeople ? (
          <Btn label="Add person (no login)" variant="secondary" onPress={() => setAddOpen(true)} />
        ) : null}
        <ErrorText message={error} />
      </Card>

      <InviteCard />

      {showLeave || showDelete || soleOwner ? (
        <Card>
          <Text style={styles.heading}>Leave or delete</Text>
          {showLeave ? (
            <Btn label="Leave household" variant="danger" onPress={() => void confirmLeave()} />
          ) : null}
          {showDelete ? (
            <Btn label="Delete family" variant="danger" onPress={() => void confirmDeleteFamily()} />
          ) : null}
          {soleOwner ? (
            <Btn label="Delete my account" variant="danger" onPress={() => void confirmDeleteAccount()} />
          ) : null}
        </Card>
      ) : null}

      <HouseholdNameSheet
        visible={nameOpen}
        name={activeHousehold.name}
        onClose={() => setNameOpen(false)}
        onSave={async (next) => {
          await renameHousehold(next);
        }}
      />
      <HouseholdEmojiSheet
        visible={emojiOpen}
        value={emoji}
        onClose={() => setEmojiOpen(false)}
        onSave={async (next) => {
          await updateHouseholdEmoji(next);
        }}
      />
      <AddPersonSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={async (input) => {
          await addPerson(input);
        }}
      />
      <FamilyPersonSheet
        visible={Boolean(selectedFresh)}
        entry={selectedFresh}
        members={members}
        people={people}
        actorRole={role}
        selfId={user?.id}
        canEdit={canEditPeople}
        canManage={canManageHousehold}
        onClose={() => setSelected(null)}
        onSavePerson={async (input) => {
          if (selectedFresh?.person) {
            await updatePerson(selectedFresh.person.id, input);
            return;
          }
          if (selectedFresh?.member) {
            await addPerson({
              ...input,
              userId: selectedFresh.member.userId,
            });
          }
        }}
        onLinkLogin={async (userId) => {
          if (!selectedFresh?.person) return;
          await linkPerson(selectedFresh.person.id, userId);
        }}
        onChangeRole={async (userId, next) => {
          await setMemberRole(userId, next);
        }}
        onRemoveLogin={async (userId) => {
          await removeMember(userId);
          setSelected(null);
        }}
        onRemovePerson={async (personId) => {
          await removePerson(personId);
          setSelected(null);
        }}
      />
    </View>
  );
}

function FamilyPersonSheet({
  visible,
  entry,
  members,
  people,
  actorRole,
  selfId,
  canEdit,
  canManage,
  onClose,
  onSavePerson,
  onLinkLogin,
  onChangeRole,
  onRemoveLogin,
  onRemovePerson,
}: {
  visible: boolean;
  entry: FamilyEntry | null;
  members: HouseholdMember[];
  people: HouseholdPerson[];
  actorRole: HouseholdRole | null;
  selfId: string | undefined;
  canEdit: boolean;
  canManage: boolean;
  onClose: () => void;
  onSavePerson: (input: {
    name: string;
    personType: PersonType;
    dietary: string[];
    birthday: string | null;
  }) => Promise<void>;
  onLinkLogin: (userId: string | null) => Promise<void>;
  onChangeRole: (userId: string, role: AssignableRole) => Promise<void>;
  onRemoveLogin: (userId: string) => Promise<void>;
  onRemovePerson: (personId: string) => Promise<void>;
}) {
  const person = entry?.person ?? null;
  const member = entry?.member ?? null;
  const isSelf = Boolean(member && selfId && member.userId === selfId);

  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('child');
  const [birthday, setBirthday] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !entry) return;
    setName(entry.person?.name ?? entry.member?.profile.displayName ?? '');
    setPersonType(entry.person?.personType ?? (member?.role === 'child' || member?.role === 'teen' ? 'child' : 'adult'));
    setBirthday(entry.person?.birthday ?? '');
    setDietary(entry.person?.dietary ?? []);
    setCustom('');
    setError(null);
  }, [visible, entry?.key, entry?.person, entry?.member, member?.role]);

  if (!entry) {
    return <Sheet visible={false} title="Family member" onClose={onClose} />;
  }

  const choices = member ? assignableRoles(actorRole, member.role, isSelf) : [];
  const removableLogin = member ? canRemoveMember(actorRole, member.role, isSelf) : false;
  const availableLogins = members.filter(
    (row) =>
      row.userId === person?.userId || !people.some((other) => other.userId === row.userId),
  );
  const customDietary = dietary.filter((tag) => !DIETARY_PRESETS.includes(tag));

  function toggleDiet(tag: string) {
    setDietary((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      await onSavePerson({
        name: name.trim(),
        personType,
        dietary,
        birthday: birthday.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function link(userId: string | null) {
    if (!person || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      await onLinkLogin(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update login');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(next: AssignableRole) {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await onChangeRole(member.userId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change role');
    } finally {
      setBusy(false);
    }
  }

  async function removeLogin() {
    if (!member) return;
    const confirmed = await confirmAction(
      'Remove from household',
      `Remove ${entry.name}? They will lose access to this household.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await onRemoveLogin(member.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    } finally {
      setBusy(false);
    }
  }

  async function removeNoLoginPerson() {
    if (!person || person.userId) return;
    const confirmed = await confirmAction(
      'Remove person',
      `Remove ${entry.name} from the family roster?`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await onRemovePerson(person.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove person');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title={entry.name} onClose={onClose}>
      <View style={styles.sheetStack}>
        {canEdit ? (
          <>
            <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" editable={!busy} />
            <OptionTiles
              label="Type"
              rows={PERSON_TYPES.map((row) => ({
                key: row.value,
                label: row.label,
                active: personType === row.value,
                disabled: busy,
                onPress: busy ? undefined : () => setPersonType(row.value),
              }))}
            />
            <BirthdayPicker value={birthday || null} onChange={(next) => setBirthday(next ?? '')} />
            <OptionTiles
              label="Dietary"
              rows={DIETARY_PRESETS.map((tag) => ({
                key: tag,
                label: tag,
                active: dietary.includes(tag),
                disabled: busy,
                onPress: busy ? undefined : () => toggleDiet(tag),
              }))}
            />
            {customDietary.length > 0 ? (
              <OptionTiles
                label="Yours"
                rows={customDietary.map((tag) => ({
                  key: `custom-${tag}`,
                  label: tag,
                  active: true,
                  disabled: busy,
                  onPress: busy ? undefined : () => toggleDiet(tag),
                }))}
              />
            ) : null}
            <Field
              label="Custom dietary"
              value={custom}
              onChangeText={setCustom}
              placeholder="e.g. soy-free"
              editable={!busy}
              onSubmitEditing={() => {
                const tag = custom.trim().toLowerCase();
                if (!tag) return;
                setDietary((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
                setCustom('');
              }}
            />
            <Btn
              label="Save"
              onPress={() => void save()}
              busy={busy}
              disabled={!name.trim()}
            />
          </>
        ) : (
          <View style={styles.readBlock}>
            <Text style={styles.meta}>Type · {personTypeLabel(personType)}</Text>
            <Text style={styles.meta}>
              Birthday · {formatBirthday(birthday || null) ?? 'Not set'}
            </Text>
            <Text style={styles.meta}>
              Dietary · {dietary.length ? dietary.join(', ') : 'None'}
            </Text>
            {!member ? <Text style={styles.meta}>Managed by household adults · no login</Text> : null}
          </View>
        )}

        {member ? (
          <View style={styles.block}>
            <Text style={styles.kicker}>Login</Text>
            <Text style={styles.memberMeta}>
              {roleLabel(isSelf && actorRole ? actorRole : member.role)}
              {member.profile.email ? ` · ${member.profile.email}` : ''}
            </Text>
            {choices.length > 0 ? (
              <OptionTiles
                label="Change role"
                rows={choices.map((choice) => ({
                  key: choice,
                  label: roleLabel(choice),
                  active: member.role === choice,
                  disabled: busy || !canChangeMemberRole(actorRole, member.role, choice, isSelf),
                  onPress:
                    busy || !canChangeMemberRole(actorRole, member.role, choice, isSelf)
                      ? undefined
                      : () => void changeRole(choice),
                }))}
              />
            ) : null}
            {removableLogin ? (
              <Btn label="Remove login access" variant="danger" onPress={() => void removeLogin()} busy={busy} />
            ) : null}
          </View>
        ) : person && canManage ? (
          <View style={styles.block}>
            <Text style={styles.kicker}>Login</Text>
            <Text style={styles.meta}>No login · any household adult can act for them</Text>
            <OptionTiles
              label="Link existing login"
              rows={[
                {
                  key: 'none',
                  label: 'No login',
                  active: !person.userId,
                  disabled: busy,
                  onPress: busy ? undefined : () => void link(null),
                },
                ...availableLogins.map((row) => ({
                  key: row.userId,
                  label: row.profile.displayName ?? row.profile.email ?? 'Member',
                  active: person.userId === row.userId,
                  disabled: busy,
                  onPress: busy ? undefined : () => void link(row.userId),
                })),
              ]}
            />
            {canManage ? (
              <Btn
                label="Remove from family"
                variant="danger"
                onPress={() => void removeNoLoginPerson()}
                busy={busy}
              />
            ) : null}
          </View>
        ) : !member ? (
          <Text style={styles.meta}>No login · any household adult can act for them</Text>
        ) : null}

        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function AddPersonSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    personType: PersonType;
    dietary: string[];
    birthday: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('child');
  const [birthday, setBirthday] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setPersonType('child');
    setBirthday('');
    setDietary([]);
    setCustom('');
    setError(null);
  }, [visible]);

  function toggleDiet(tag: string) {
    setDietary((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        personType,
        dietary,
        birthday: birthday.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person');
    } finally {
      setBusy(false);
    }
  }

  const customDietary = dietary.filter((tag) => !DIETARY_PRESETS.includes(tag));

  return (
    <Sheet visible={visible} title="Add person" onClose={onClose}>
      <View style={styles.sheetStack}>
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" editable={!busy} />
        <OptionTiles
          label="Type"
          rows={PERSON_TYPES.map((row) => ({
            key: row.value,
            label: row.label,
            active: personType === row.value,
            disabled: busy,
            onPress: busy ? undefined : () => setPersonType(row.value),
          }))}
        />
        <BirthdayPicker value={birthday || null} onChange={(next) => setBirthday(next ?? '')} />
        <OptionTiles
          label="Dietary"
          rows={DIETARY_PRESETS.map((tag) => ({
            key: tag,
            label: tag,
            active: dietary.includes(tag),
            disabled: busy,
            onPress: busy ? undefined : () => toggleDiet(tag),
          }))}
        />
        {customDietary.length > 0 ? (
          <OptionTiles
            label="Yours"
            rows={customDietary.map((tag) => ({
              key: `custom-${tag}`,
              label: tag,
              active: true,
              disabled: busy,
              onPress: busy ? undefined : () => toggleDiet(tag),
            }))}
          />
        ) : null}
        <Field
          label="Custom dietary"
          value={custom}
          onChangeText={setCustom}
          placeholder="e.g. soy-free"
          editable={!busy}
          onSubmitEditing={() => {
            const tag = custom.trim().toLowerCase();
            if (!tag) return;
            setDietary((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
            setCustom('');
          }}
        />
        <Btn label="Add" onPress={() => void save()} busy={busy} disabled={!name.trim()} />
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function HouseholdNameSheet({
  visible,
  name,
  onClose,
  onSave,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(name);
    setError(null);
  }, [visible, name]);

  const dirty = draft.trim() !== name.trim() && Boolean(draft.trim());

  async function save() {
    if (!dirty) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(draft.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Household name" onClose={onClose}>
      <View style={styles.sheetStack}>
        <Field label="Name" value={draft} onChangeText={setDraft} autoCapitalize="words" editable={!busy} />
        <Btn label="Save" onPress={() => void save()} busy={busy} disabled={!dirty} />
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function HouseholdEmojiSheet({
  visible,
  value,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSave: (emoji: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
  }, [visible]);

  async function pick(next: string) {
    if (busy) return;
    if (next === value) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save logo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Household logo" onClose={onClose}>
      <View style={styles.sheetStack}>
        <View style={styles.emojiGrid}>
          {HOUSEHOLD_EMOJIS.map((item) => {
            const active = item === value;
            return (
              <Pressable
                key={item}
                onPress={() => void pick(item)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: busy }}
                style={[styles.emojiCell, active && styles.emojiCellActive, busy && styles.emojiCellBusy]}>
                <Text style={styles.emojiCellGlyph}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <ErrorText message={error} />
      </View>
    </Sheet>
  );
}

function InviteCard() {
  const { role: actorRole, canInvite, createInvite, revokeInvite, invites } = useHousehold();
  const choices = inviteRoles(actorRole);
  const [inviteRole, setInviteRole] = useState<AssignableRole>(choices[0] ?? 'adult');
  const [created, setCreated] = useState<{ url: string; token: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (choices.length === 0) return;
    if (!choices.includes(inviteRole)) setInviteRole(choices[0]!);
  }, [choices, inviteRole]);

  if (!canInvite) {
    return (
      <Card>
        <Text style={styles.heading}>Invite</Text>
        <Text style={styles.meta}>Owners, admins, and adults can invite.</Text>
      </Card>
    );
  }

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      const invite = await createInvite(inviteRole);
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
      <Text style={styles.heading}>Invite</Text>
      <OptionTiles
        label="Role"
        rows={choices.map((choice) => ({
          key: choice,
          label: roleLabel(choice),
          active: inviteRole === choice,
          onPress: () => setInviteRole(choice),
        }))}
      />
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
          <Text style={styles.kicker}>Token</Text>
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
    <View style={styles.pendingRow}>
      <View style={styles.memberText}>
        <Text style={styles.memberName}>{roleLabel(invite.role)}</Text>
        <Text style={styles.meta}>Expires {new Date(invite.expiresAt).toLocaleString()}</Text>
      </View>
      <Pressable onPress={onRevoke} hitSlop={8}>
        <Text style={styles.dangerLink}>Revoke</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRoot: {
    gap: 16,
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  heroWide: {
    paddingVertical: 20,
    gap: 16,
  },
  emojiTap: {
    position: 'relative',
  },
  emojiDisk: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiDiskWide: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  emojiGlyph: {
    fontSize: 48,
    lineHeight: 56,
  },
  emojiGlyphWide: {
    fontSize: 56,
    lineHeight: 64,
  },
  emojiEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 16, 22, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiEditGlyph: {
    color: 'rgba(238, 243, 248, 0.55)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  heroIdentity: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  namePress: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameHeading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
  },
  nameHeadingWide: {
    fontSize: 28,
    lineHeight: 34,
  },
  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgHover,
  },
  switchChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  switchChipEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  switchChipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  switchChipLabelActive: {
    color: colors.accent,
  },
  heading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: 0.86,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  chevron: {
    color: colors.textDim,
    fontSize: 22,
    fontWeight: '300',
    paddingHorizontal: 4,
  },
  meta: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  dangerLink: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  sheetStack: {
    gap: 12,
    paddingTop: space.sm,
  },
  block: {
    gap: 8,
  },
  readBlock: {
    gap: 6,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiCell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCellActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  emojiCellBusy: {
    opacity: 0.55,
  },
  emojiCellGlyph: {
    fontSize: 24,
    lineHeight: 30,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
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
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
