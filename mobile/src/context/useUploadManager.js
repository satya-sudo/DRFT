import { useEffect, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
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

function createStagedFileName(asset, index) {
  const rawName = formatAssetName(asset, index).replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${Date.now()}-${index}-${rawName}`;
}

function getUploadsDirectory() {
  const directory = new Directory(Paths.cache, "drft-uploads");
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  return directory;
}

async function stageAssetForUpload(asset, index) {
  const uploadsDirectory = getUploadsDirectory();
  const stagedFile = new File(uploadsDirectory, createStagedFileName(asset, index));

  if (stagedFile.exists) {
    stagedFile.delete();
  }
  stagedFile.create({ intermediates: true, overwrite: true });

  try {
    const sourceFile = new File(asset.uri);
    sourceFile.copy(stagedFile);
  } catch {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error("Could not prepare the selected file for upload");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    stagedFile.write(bytes);
  }

  return {
    ...asset,
    stagedFileUri: stagedFile.uri,
    uri: stagedFile.uri
  };
}

function deleteStagedFile(asset) {
  if (!asset?.stagedFileUri) {
    return;
  }

  try {
    const stagedFile = new File(asset.stagedFileUri);
    if (stagedFile.exists) {
      stagedFile.delete();
    }
  } catch {
    // Ignore cleanup failures for temporary upload staging.
  }
}

export function useUploadManager(token) {
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadQueueOpen, setUploadQueueOpen] = useState(false);
  const [uploadActivityKey, setUploadActivityKey] = useState(0);

  useEffect(() => {
    if (token) {
      return;
    }

    uploadQueue.forEach((entry) => deleteStagedFile(entry.asset));
    setUploadQueue([]);
    setUploadQueueOpen(false);
    setUploadActivityKey(0);
  }, [token]);

  function clearCompletedUploads(uploadIDs) {
    setUploadQueue((currentValue) => {
      currentValue.forEach((entry) => {
        if (uploadIDs.includes(entry.id)) {
          deleteStagedFile(entry.asset);
        }
      });

      return currentValue.filter((entry) => !uploadIDs.includes(entry.id));
    });
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
        onStatus: ({ message, mode, phase }) => {
          setUploadQueue((currentValue) =>
            currentValue.map((entry) =>
              entry.id === uploadID
                ? {
                    ...entry,
                    detail: message,
                    mode: mode || entry.mode,
                    phase: phase || entry.phase
                  }
                : entry
            )
          );
        },
        onChunkRetry: ({ attempt, error }) => {
          setUploadQueue((currentValue) =>
            currentValue.map((entry) =>
              entry.id === uploadID
                ? {
                    ...entry,
                    status: "retrying",
                    detail: `Retry ${attempt} in progress`,
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

    const stagedAssets = [];
    for (let index = 0; index < assets.length; index += 1) {
      stagedAssets.push(await stageAssetForUpload(assets[index], index));
    }

    const nextEntries = stagedAssets.map((asset, index) => ({
      id: createUploadID(asset, index),
      asset,
      name: formatAssetName(asset, index),
      sizeBytes: asset.fileSize || 0,
      progress: 0,
      detail: "Preparing upload",
      mode: "",
      phase: "prepare",
      status: "uploading",
      error: ""
    }));

    setUploadQueueOpen(true);
    setUploadQueue((currentValue) => [...nextEntries, ...currentValue]);

    for (let index = 0; index < stagedAssets.length; index += 1) {
      const asset = stagedAssets[index];
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
