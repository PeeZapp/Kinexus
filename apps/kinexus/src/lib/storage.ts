import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITE_KEY = 'kinexus.pendingInviteToken';
const ACTIVE_HOUSEHOLD_KEY = 'kinexus.activeHouseholdId';
const ROLE_PREVIEW_KEY = 'kinexus.rolePreview';

export async function savePendingInvite(token: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, token);
}

export async function readPendingInvite(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_INVITE_KEY);
}

export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY);
}

export async function saveActiveHouseholdId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_HOUSEHOLD_KEY, id);
}

export async function readActiveHouseholdId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_HOUSEHOLD_KEY);
}

export async function clearActiveHouseholdId(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_HOUSEHOLD_KEY);
}

function rolePreviewStorageKey(userId: string): string {
  return `${ROLE_PREVIEW_KEY}.${userId}`;
}

export async function readRolePreview(userId: string): Promise<string | null> {
  return AsyncStorage.getItem(rolePreviewStorageKey(userId));
}

export async function saveRolePreview(userId: string, role: string | null): Promise<void> {
  const key = rolePreviewStorageKey(userId);
  if (!role) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, role);
}
