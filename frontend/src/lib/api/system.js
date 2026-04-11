import { requestJSON } from "./client";

export function getSystemVersion() {
  return requestJSON("/version");
}
