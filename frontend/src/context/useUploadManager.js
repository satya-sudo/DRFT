import { useEffect, useRef, useState } from "react";
import * as filesApi from "../lib/api/files";

function createUploadID(file) {
  return `upload-${file.name}-${file.lastModified}`;
}

function createLocalMediaItems(fileList) {
  return Array.from(fileList).map((file) => ({
    id: `local-${file.name}-${file.lastModified}`,
    uploadID: createUploadID(file),
    fileName: file.name.replace(/\.[^.]+$/, ""),
    mediaType: file.type.startsWith("video") ? "video" : "image",
    mimeType: file.type,
    sizeBytes: file.size,
    takenAt: new Date().toISOString(),
    previewUrl: URL.createObjectURL(file),
    localOnly: true
  }));
}

function revokePreviewItems(items) {
  items.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

export function useUploadManager(token) {
  const [uploadQueue, setUploadQueue] = useState([]);
  const [localUploadItems, setLocalUploadItems] = useState([]);
  const [uploadQueueOpen, setUploadQueueOpen] = useState(false);
  const [uploadActivityKey, setUploadActivityKey] = useState(0);
  const localUploadItemsRef = useRef([]);

  useEffect(() => {
    localUploadItemsRef.current = localUploadItems;
  }, [localUploadItems]);

  useEffect(() => {
    return () => {
      revokePreviewItems(localUploadItemsRef.current);
    };
  }, []);

  function clearCompletedUploads(uploadIDs) {
    setLocalUploadItems((currentValue) => {
      const removingItems = currentValue.filter((item) => uploadIDs.includes(item.uploadID));
      revokePreviewItems(removingItems);
      return currentValue.filter((item) => !uploadIDs.includes(item.uploadID));
    });
    setUploadQueue((currentValue) =>
      currentValue.filter((entry) => !uploadIDs.includes(entry.id))
    );
  }

  async function enqueueUploads(fileList) {
    if (!token || !fileList?.length) {
      return;
    }

    const files = Array.from(fileList);
    const previewItems = createLocalMediaItems(files);
    const nextEntries = files.map((file) => ({
      id: createUploadID(file),
      name: file.name,
      sizeBytes: file.size,
      progress: 0,
      status: "uploading",
      error: ""
    }));

    setUploadQueueOpen(true);
    setLocalUploadItems((currentValue) => [...previewItems, ...currentValue]);
    setUploadQueue((currentValue) => [...nextEntries, ...currentValue]);

    for (const file of files) {
      const uploadID = createUploadID(file);

      try {
        await filesApi.uploadFileWithProgress(token, file, (progress) => {
          setUploadQueue((currentValue) =>
            currentValue.map((entry) =>
              entry.id === uploadID ? { ...entry, progress } : entry
            )
          );
        });

        setUploadQueue((currentValue) =>
          currentValue.map((entry) =>
            entry.id === uploadID
              ? { ...entry, progress: 100, status: "done", error: "" }
              : entry
          )
        );
        setUploadActivityKey((currentValue) => currentValue + 1);

        window.setTimeout(() => {
          clearCompletedUploads([uploadID]);
        }, 1500);
      } catch (error) {
        setUploadQueue((currentValue) =>
          currentValue.map((entry) =>
            entry.id === uploadID
              ? {
                  ...entry,
                  status: "error",
                  error: error.message || "Upload failed"
                }
              : entry
          )
        );
      }
    }
  }

  return {
    enqueueUploads,
    localUploadItems,
    uploadQueue,
    uploadQueueOpen,
    setUploadQueueOpen,
    uploadActivityKey
  };
}
