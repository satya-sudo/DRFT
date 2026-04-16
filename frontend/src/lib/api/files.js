import { requestJSON } from "./client";

const chunkedUploadThresholdBytes = 16 * 1024 * 1024;
const defaultChunkTimeoutMs = 120000;
const chunkRetryLimit = 3;
const chunkRetryDelayMs = 1000;

function parseUploadResponse(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function listFiles(token) {
  return requestJSON("/api/v1/files", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function getStorageStats(token) {
  return requestJSON("/api/v1/storage/stats", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function uploadFile(token, file) {
  return uploadFileWithProgress(token, file);
}

async function requestChunkedJSON(path, options = {}) {
  const controller = new AbortController();
  const timeoutID = window.setTimeout(() => controller.abort(), defaultChunkTimeoutMs);

  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal
    }).catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("Upload timed out before DRFT finished processing it");
      }

      throw new Error("Unable to reach DRFT API");
    });

    const payload = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      throw new Error(
        payload?.error || payload?.message || response.statusText || "Upload failed."
      );
    }

    return payload;
  } finally {
    window.clearTimeout(timeoutID);
  }
}

function wait(delayMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

async function uploadChunkWithRetry({
  token,
  uploadId,
  chunk,
  chunkIndex,
  onChunkRetry
}) {
  let attempt = 0;

  while (attempt < chunkRetryLimit) {
    try {
      return await requestChunkedJSON(`/api/v1/uploads/${uploadId}/chunks/${chunkIndex}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream"
        },
        body: chunk
      });
    } catch (error) {
      attempt += 1;

      if (attempt >= chunkRetryLimit) {
        throw new Error(
          `Chunk ${chunkIndex + 1} failed after ${chunkRetryLimit} attempts: ${error.message}`
        );
      }

      if (typeof onChunkRetry === "function") {
        onChunkRetry({
          chunkIndex,
          attempt,
          remainingAttempts: chunkRetryLimit - attempt,
          error: error.message
        });
      }

      await wait(chunkRetryDelayMs * attempt);
    }
  }
}

async function uploadFileInChunks(token, file, onProgress, onChunkRetry) {
  const session = await requestChunkedJSON("/api/v1/uploads/init", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type
    })
  });

  const totalChunks = session.totalChunks || 1;
  const chunkSize = session.chunkSize || file.size;
  let uploadedBytes = 0;

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      await uploadChunkWithRetry({
        token,
        uploadId: session.uploadId,
        chunk,
        chunkIndex: index,
        onChunkRetry
      });

      uploadedBytes = end;
      if (typeof onProgress === "function") {
        onProgress(Math.round((uploadedBytes / file.size) * 100));
      }
    }

    return requestChunkedJSON(`/api/v1/uploads/${session.uploadId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    requestChunkedJSON(`/api/v1/uploads/${session.uploadId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).catch(() => {});
    throw error;
  }
}

export function uploadFileWithProgress(token, file, onProgress, options = {}) {
  if (file.size >= chunkedUploadThresholdBytes) {
    return uploadFileInChunks(token, file, onProgress, options.onChunkRetry);
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);

    request.open("POST", "/api/v1/upload");
    request.setRequestHeader("Authorization", `Bearer ${token}`);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    request.addEventListener("load", () => {
      const payload = parseUploadResponse(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(
        new Error(
          payload?.error ||
            payload?.message ||
            request.statusText ||
            "Upload failed."
        )
      );
    });

    request.addEventListener("error", () => {
      reject(new Error("Unable to reach DRFT API"));
    });

    request.addEventListener("timeout", () => {
      reject(new Error("Upload timed out before DRFT finished processing it"));
    });

    request.timeout = 120000;

    request.send(body);
  });
}

export function deleteFile(token, fileID) {
  return requestJSON(`/api/v1/file/${fileID}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
