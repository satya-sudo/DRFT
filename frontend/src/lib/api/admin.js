import { requestJSON } from "./client";

export function listUsers(token) {
  return requestJSON("/api/v1/admin/users", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function createUser(token, payload) {
  return requestJSON("/api/v1/admin/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: payload
  });
}

export function deleteUser(token, userID) {
  return requestJSON(`/api/v1/admin/users/${userID}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
