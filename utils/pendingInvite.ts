import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pending_invite_token";

export async function setPendingInviteToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token);
}

export async function getPendingInviteToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearPendingInviteToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
