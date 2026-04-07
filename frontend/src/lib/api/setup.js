import { requestJSON } from "./client";

export function getSetupStatus() {
  return requestJSON("/api/v1/setup/status");
}

export function createInitialAdmin(payload) {
  return requestJSON("/api/v1/setup/admin", {
    method: "POST",
    body: payload
  });
}
