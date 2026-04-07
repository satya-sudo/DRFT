const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const FALLBACK_STATUSES = [404, 405, 501];

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
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body
  }).catch(() => {
    throw new APIError("Unable to reach DRFT API", { network: true });
  });

  const isJSON = response.headers.get("content-type")?.includes("application/json");
  const payload = isJSON ? await response.json() : null;

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

export async function requestWithFallback({ path, options, fallback }) {
  try {
    const payload = await requestJSON(path, options);
    return { ...payload, demoMode: false };
  } catch (error) {
    if (error.network || FALLBACK_STATUSES.includes(error.status)) {
      const demoPayload = await fallback();
      return { ...demoPayload, demoMode: true };
    }

    throw error;
  }
}
