import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_STORAGE_KEY = "drft.mobile.session.token";
const USER_STORAGE_KEY = "drft.mobile.session.user";

export function getStoredSessionToken() {
  return AsyncStorage.getItem(TOKEN_STORAGE_KEY);
}

export function persistSessionToken(token) {
  return AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredSessionToken() {
  return AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function getStoredSessionUser() {
  const value = await AsyncStorage.getItem(USER_STORAGE_KEY);
  return value ? JSON.parse(value) : null;
}

export function persistSessionUser(user) {
  return AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredSessionUser() {
  return AsyncStorage.removeItem(USER_STORAGE_KEY);
}
