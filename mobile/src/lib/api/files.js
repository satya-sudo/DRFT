import { buildAPIURL } from "../config";
import { requestJSON } from "./client";

const chunkedUploadThresholdBytes = 16 * 1024 * 1024;
const defaultChunkTimeoutMs = 120000;
const chunkRetryLimit = 3;
const chunkRetryDelayMs = 1000;

function notifyStatus(callback, status) {
  if (typeof callback === "function") {
    callback(status);
  }

  if (status?.message) {
    console.info("[DRFT upload]", status.message);
  }
}

function clampProgress(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function shouldUseChunkedUpload(asset) {
  const sizeBytes = asset.fileSize || 0;
  const uri = asset.uri || "";

  return sizeBytes >= chunkedUploadThresholdBytes && uri.startsWith("file://");
}

export function listFiles(token, options = {}) {
  const limit = options.limit || 40;
  const offset = options.offset || 0;

  return requestJSON(`/api/v1/files?limit=${limit}&offset=${offset}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

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

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function requestChunkedJSON(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), defaultChunkTimeoutMs);

  try {
    const response = await fetch(buildAPIURL(path), {
      ...options,
      signal: controller.signal
    }).catch((error) => {
      if (error?.name === "AbortError") {
        throw new Error("Upload timed out before DRFT finished processing it");
      }

      throw new Error("Unable to reach DRFT API");
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      throw new Error(
        payload?.error || payload?.message || response.statusText || "Upload failed."
      );
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getAssetBlob(asset) {
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error("Could not read the selected file");
  }

  return response.blob();
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

async function uploadAssetInChunks(token, asset, onProgress, options = {}) {
  notifyStatus(options.onStatus, {
    mode: "chunked",
    phase: "prepare",
    message: "Using chunked upload"
  });
  const blob = await getAssetBlob(asset);
  const fileName = asset.fileName || asset.name || `upload-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || asset.type || blob.type || "application/octet-stream";
  const sizeBytes = asset.fileSize || blob.size;
  notifyStatus(options.onStatus, {
    mode: "chunked",
    phase: "init",
    message: "Creating upload session"
  });
  const session = await requestChunkedJSON("/api/v1/uploads/init", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName,
      sizeBytes,
      mimeType
    })
  });

  const totalChunks = session.totalChunks || 1;
  const chunkSize = session.chunkSize || sizeBytes;
  let uploadedBytes = 0;

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, sizeBytes);
      const chunk = blob.slice(start, end, mimeType);

      notifyStatus(options.onStatus, {
        mode: "chunked",
        phase: "chunk",
        message: `Uploading chunk ${index + 1} of ${totalChunks}`
      });
      await uploadChunkWithRetry({
        token,
        uploadId: session.uploadId,
        chunk,
        chunkIndex: index,
        onChunkRetry: options.onChunkRetry
      });

      uploadedBytes = end;
      if (typeof onProgress === "function") {
        onProgress(clampProgress((uploadedBytes / sizeBytes) * 100));
      }
    }

    notifyStatus(options.onStatus, {
      mode: "chunked",
      phase: "finalize",
      message: "Finalizing upload"
    });
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

export function uploadAssetWithProgress(token, asset, onProgress, options = {}) {
  if (shouldUseChunkedUpload(asset)) {
    notifyStatus(options.onStatus, {
      mode: "chunked",
      phase: "selected",
      message: "Selected chunked upload path"
    });
    return uploadAssetInChunks(token, asset, onProgress, options);
  }

  notifyStatus(options.onStatus, {
    mode: "direct",
    phase: "selected",
    message: "Selected direct upload path"
  });

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", {
      uri: asset.uri,
      name: asset.fileName || asset.name || `upload-${Date.now()}.jpg`,
      type: asset.mimeType || asset.type || "application/octet-stream"
    });

    request.open("POST", buildAPIURL("/api/v1/upload"));
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    notifyStatus(options.onStatus, {
      mode: "direct",
      phase: "upload",
      message: "Uploading file directly"
    });

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || typeof onProgress !== "function") {
        return;
      }

      onProgress(clampProgress((event.loaded / event.total) * 100));
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

    request.timeout = defaultChunkTimeoutMs;

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
