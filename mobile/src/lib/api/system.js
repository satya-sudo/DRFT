import { requestJSON } from "./client";

export function checkServer(baseUrl) {
  return requestJSON("/healthz", {
    baseUrl
  });
}
