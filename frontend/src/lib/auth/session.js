const STORAGE_KEY = "drft.session.token";

export function getStoredSessionToken() {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function persistSessionToken(token) {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredSessionToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}

