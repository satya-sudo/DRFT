import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "drft.mobile.api-base-url";
const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";

let runtimeApiBaseUrl = "";

export function normalizeApiBaseUrl(value) {
  return (value || "").trim().replace(/\/+$/, "");
}

export function getRuntimeApiBaseUrl() {
  return runtimeApiBaseUrl;
}

export function setRuntimeApiBaseUrl(value) {
  runtimeApiBaseUrl = normalizeApiBaseUrl(value);
  return runtimeApiBaseUrl;
}

export function buildAPIURL(path, options = {}) {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl || runtimeApiBaseUrl);

  if (!baseUrl) {
    throw new Error("DRFT server is not configured.");
  }

  return `${baseUrl}${path}`;
}

export function buildAuthenticatedMediaURL(path, token) {
  const url = new URL(buildAPIURL(path));

  if (token) {
    url.searchParams.set("access_token", token);
  }

  return url.toString();
}

export function getSuggestedApiBaseUrl() {
  return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
}

export async function getStoredApiBaseUrl() {
  const storedValue = await AsyncStorage.getItem(STORAGE_KEY);
  return normalizeApiBaseUrl(storedValue);
}

export async function persistApiBaseUrl(value) {
  const normalized = normalizeApiBaseUrl(value);
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
  setRuntimeApiBaseUrl(normalized);
  return normalized;
}

export async function clearStoredApiBaseUrl() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  setRuntimeApiBaseUrl("");
}
