import { useEffect, useState } from "react";
import * as filesApi from "../lib/api/files";

const completedUploadDismissDelayMs = 1500;

function createUploadID(asset, index) {
  const fileName = asset.fileName || asset.name || asset.uri?.split("/").pop() || `asset-${index}`;
  const size = asset.fileSize || 0;
  return `upload-${fileName}-${size}-${index}`;
}

function formatAssetName(asset, index) {
  return asset.fileName || asset.name || asset.uri?.split("/").pop() || `Upload ${index + 1}`;
}

export function useUploadManager(token) {
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadQueueOpen, setUploadQueueOpen] = useState(false);
  const [uploadActivityKey, setUploadActivityKey] = useState(0);

  useEffect(() => {
    if (token) {
      return;
    }

    setUploadQueue([]);
    setUploadQueueOpen(false);
    setUploadActivityKey(0);
  }, [token]);

  function clearCompletedUploads(uploadIDs) {
    setUploadQueue((currentValue) =>
      currentValue.filter((entry) => !uploadIDs.includes(entry.id))
    );
  }

  async function runUpload(asset, uploadID) {
    await filesApi.uploadAssetWithProgress(
      token,
      asset,
      (progress) => {
        setUploadQueue((currentValue) =>
          currentValue.map((entry) =>
            entry.id === uploadID
              ? { ...entry, progress, status: "uploading", error: "" }
              : entry
          )
        );
      },
      {
        onChunkRetry: ({ attempt, error }) => {
          setUploadQueue((currentValue) =>
            currentValue.map((entry) =>
              entry.id === uploadID
                ? {
                    ...entry,
                    status: "retrying",
                    error: `Retry ${attempt} in progress: ${error}`
                  }
                : entry
            )
          );
        }
      }
    );

    setUploadQueue((currentValue) =>
      currentValue.map((entry) =>
        entry.id === uploadID
          ? { ...entry, progress: 100, status: "done", error: "" }
          : entry
      )
    );
    setUploadActivityKey((currentValue) => currentValue + 1);

    setTimeout(() => {
      clearCompletedUploads([uploadID]);
    }, completedUploadDismissDelayMs);
  }

  async function retryUpload(uploadID) {
    const retryEntry = uploadQueue.find((entry) => entry.id === uploadID);

    if (!retryEntry?.asset || !token) {
      return;
    }

    setUploadQueue((currentValue) =>
      currentValue.map((entry) =>
        entry.id === uploadID
          ? { ...entry, progress: 0, status: "uploading", error: "" }
          : entry
      )
    );

    try {
      await runUpload(retryEntry.asset, uploadID);
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

  async function enqueueAssets(assets) {
    if (!token || !assets?.length) {
      return;
    }

    const nextEntries = assets.map((asset, index) => ({
      id: createUploadID(asset, index),
      asset,
      name: formatAssetName(asset, index),
      sizeBytes: asset.fileSize || 0,
      progress: 0,
      status: "uploading",
      error: ""
    }));

    setUploadQueueOpen(true);
    setUploadQueue((currentValue) => [...nextEntries, ...currentValue]);

    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      const uploadID = createUploadID(asset, index);

      try {
        await runUpload(asset, uploadID);
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
    enqueueAssets,
    retryUpload,
    uploadQueue,
    uploadQueueOpen,
    setUploadQueueOpen,
    uploadActivityKey
  };
}
