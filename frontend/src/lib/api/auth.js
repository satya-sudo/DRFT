import { requestJSON } from "./client";

export function login(payload) {
  return requestJSON("/api/v1/auth/login", {
    method: "POST",
    body: payload
  });
}

export function getCurrentUser(token) {
  return requestJSON("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function requestPasswordReset(payload) {
  return requestJSON("/api/v1/auth/password-reset/request", {
    method: "POST",
    body: payload
  });
}

export function confirmPasswordReset(payload) {
  return requestJSON("/api/v1/auth/password-reset/confirm", {
    method: "POST",
    body: payload
  });
}
