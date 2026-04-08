import { buildAPIURL } from "../config";

const REQUEST_TIMEOUT_MS = 8000;

export class APIError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "APIError";
    this.status = options.status || 500;
    this.payload = options.payload;
    this.network = Boolean(options.network);
  }
}

export async function requestJSON(path, options = {}) {
  const { baseUrl: requestBaseUrl, ...requestOptions } = options;
  const headers = {
    ...(requestOptions.headers || {})
  };
  let body = requestOptions.body;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob)
  ) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildAPIURL(path, { baseUrl: requestBaseUrl }), {
      ...requestOptions,
      headers,
      body,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new APIError("DRFT API request timed out", { network: true });
    }

    throw new APIError("Unable to reach DRFT API", { network: true });
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new APIError(
      payload?.error || payload?.message || "The request could not be completed.",
      {
        status: response.status,
        payload
      }
    );
  }

  return payload;
}
