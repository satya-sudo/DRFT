import { requestJSON } from "./client";

export function getSystemStatus() {
  return requestJSON("/healthz");
}
