import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITE_KEY = 'kinexus.pendingInviteToken';
const ACTIVE_HOUSEHOLD_KEY = 'kinexus.activeHouseholdId';

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
