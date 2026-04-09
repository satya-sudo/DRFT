import { requestJSON } from "./client";

function withAuth(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export function listAlbums(token) {
  return requestJSON("/api/v1/albums", {
    headers: withAuth(token)
  });
}

export function createAlbum(token, payload) {
  return requestJSON("/api/v1/albums", {
    method: "POST",
    headers: withAuth(token),
    body: payload
  });
}

export function getAlbum(token, albumID) {
  return requestJSON(`/api/v1/albums/${albumID}`, {
    headers: withAuth(token)
  });
}

export function updateAlbum(token, albumID, payload) {
  return requestJSON(`/api/v1/albums/${albumID}`, {
    method: "PATCH",
    headers: withAuth(token),
    body: payload
  });
}

export function deleteAlbum(token, albumID) {
  return requestJSON(`/api/v1/albums/${albumID}`, {
    method: "DELETE",
    headers: withAuth(token)
  });
}

export function addFilesToAlbum(token, albumID, fileIDs) {
  return requestJSON(`/api/v1/albums/${albumID}/files`, {
    method: "POST",
    headers: withAuth(token),
    body: { fileIds: fileIDs }
  });
}

export function removeFileFromAlbum(token, albumID, fileID) {
  return requestJSON(`/api/v1/albums/${albumID}/files/${fileID}`, {
    method: "DELETE",
    headers: withAuth(token)
  });
}

export function listTags(token) {
  return requestJSON("/api/v1/tags", {
    headers: withAuth(token)
  });
}

export function createTag(token, payload) {
  return requestJSON("/api/v1/tags", {
    method: "POST",
    headers: withAuth(token),
    body: payload
  });
}

export function getTag(token, tagID) {
  return requestJSON(`/api/v1/tags/${tagID}`, {
    headers: withAuth(token)
  });
}

export function updateTag(token, tagID, payload) {
  return requestJSON(`/api/v1/tags/${tagID}`, {
    method: "PATCH",
    headers: withAuth(token),
    body: payload
  });
}

export function deleteTag(token, tagID) {
  return requestJSON(`/api/v1/tags/${tagID}`, {
    method: "DELETE",
    headers: withAuth(token)
  });
}

export function addTagToFile(token, fileID, tagID) {
  return requestJSON(`/api/v1/files/${fileID}/tags`, {
    method: "POST",
    headers: withAuth(token),
    body: { tagId: tagID }
  });
}

export function removeTagFromFile(token, fileID, tagID) {
  return requestJSON(`/api/v1/files/${fileID}/tags/${tagID}`, {
    method: "DELETE",
    headers: withAuth(token)
  });
}
