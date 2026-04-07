import { requestJSON } from "./client";

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
      const payload = request.responseText ? JSON.parse(request.responseText) : null;

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload?.error || "Upload failed."));
    });

    request.addEventListener("error", () => {
      reject(new Error("Unable to reach DRFT API"));
    });

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
