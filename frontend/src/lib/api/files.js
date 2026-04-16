import { requestJSON } from "./client";

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

export function uploadFileWithProgress(token, file, onProgress) {
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
