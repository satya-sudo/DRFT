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
