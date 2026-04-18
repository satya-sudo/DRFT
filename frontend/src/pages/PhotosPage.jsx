import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import MediaGrid from "../components/MediaGrid";
import MediaViewer from "../components/MediaViewer";
import { Icon } from "../components/Icons";
import { useApp } from "../context/AppContext";
import * as filesAPI from "../lib/api/files";

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) {
    return "Unknown";
  }

  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );
  const amount = value / 1024 ** exponent;
  const digits = amount >= 100 || exponent === 0 ? 0 : amount >= 10 ? 1 : 2;

  return `${amount.toFixed(digits)} ${units[exponent]}`;
}

export default function PhotosPage() {
  const { enqueueUploads, localUploadItems, token, uploadActivityKey } = useApp();
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const loadMoreRef = useRef(null);
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ limit: 40, offset: 0, hasMore: true });
  const [storageStats, setStorageStats] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewerPanel, setViewerPanel] = useState("none");
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFiles({ reset: true });
  }, [token, uploadActivityKey]);

  useEffect(() => {
    const nextFilter = searchParams.get("filter") || "all";
    setFilter(nextFilter);
  }, [searchParams]);

  useEffect(() => {
    if (!folderInputRef.current) {
      return;
    }

    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || loadingMore || !pagination.hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadFiles({ reset: false });
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, loadingMore, pagination.hasMore, pagination.offset, token]);

  async function loadFiles({ reset = false } = {}) {
    if (!token) {
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        setError("");
      } else {
        if (!pagination.hasMore || loadingMore) {
          return;
        }
        setLoadingMore(true);
      }

      const requestOffset = reset ? 0 : pagination.offset;
      const [filesResponse, statsResponse] = await Promise.all([
        filesAPI.listFiles(token, {
          limit: pagination.limit,
          offset: requestOffset
        }),
        reset ? filesAPI.getStorageStats(token) : Promise.resolve(storageStats)
      ]);

      setItems((currentValue) => {
        if (reset) {
          return filesResponse.items || [];
        }

        const seen = new Set(currentValue.map((item) => item.id));
        const nextItems = [...currentValue];
        (filesResponse.items || []).forEach((item) => {
          if (!seen.has(item.id)) {
            nextItems.push(item);
          }
        });
        return nextItems;
      });
      setPagination({
        limit: filesResponse.pagination?.limit || pagination.limit,
        offset: filesResponse.pagination?.nextOffset || requestOffset,
        hasMore: Boolean(filesResponse.pagination?.hasMore)
      });

      if (reset) {
        setStorageStats(statsResponse);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }

  async function handleLocalUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);
    await enqueueUploads(selectedFiles);
    event.target.value = "";
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDropActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files || []);
    await enqueueUploads(droppedFiles);
  }

  async function handleDeleteFile(item) {
    setConfirmDeleteItem(item);
  }

  async function confirmDelete() {
    const item = confirmDeleteItem;
    if (!item) {
      return;
    }

    if (item.localOnly) {
      setSelectedItem(null);
      setConfirmDeleteItem(null);
      return;
    }

    try {
      await filesAPI.deleteFile(token, item.id);
      setSelectedItem(null);
      setItems((currentValue) => currentValue.filter((entry) => entry.id !== item.id));
      setConfirmDeleteItem(null);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const combinedItems = [...localUploadItems, ...items].filter((item) => {
    const matchesFilter = filter === "all" ? true : item.mediaType === filter;
    const matchesSearch = item.fileName
      .toLowerCase()
      .includes(searchValue.trim().toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const groupedItems = combinedItems.reduce((groups, item) => {
    const key = item.takenAt.slice(0, 10);
    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);
    return groups;
  }, {});

  const orderedGroups = Object.entries(groupedItems).sort((left, right) =>
    right[0].localeCompare(left[0])
  );

  const imageCount = combinedItems.filter((item) => item.mediaType === "image").length;
  const videoCount = combinedItems.filter((item) => item.mediaType === "video").length;
  const pageTitle =
    filter === "image" ? "Images" : filter === "video" ? "Videos" : "All media";
  const pageDescription =
    filter === "image"
      ? "Browse image uploads only, with the same timeline structure and global upload queue."
      : filter === "video"
        ? "Browse videos only, with global uploads still running in the background."
        : "A calm, date-led view of your photos and videos with room for uploads, viewer details, and future device sync.";

  return (
    <AppShell
      title={pageTitle}
      description={pageDescription}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      sidebarContent={
        <div className="sidebar-stats">
          <div className="sidebar-stats-header">
            <span className="eyebrow">Library</span>
            <strong>{combinedItems.length} items</strong>
          </div>
          <div className="sidebar-stats-grid">
            <div className="sidebar-stat">
              <strong>{imageCount}</strong>
              <span>Images</span>
            </div>
            <div className="sidebar-stat">
              <strong>{videoCount}</strong>
              <span>Videos</span>
            </div>
            <div className="sidebar-stat">
              <strong>{formatBytes(storageStats?.drftUsedBytes ?? 0)}</strong>
              <span>DRFT used</span>
            </div>
            <div className="sidebar-stat">
              <strong>{formatBytes(storageStats?.availableBytes ?? 0)}</strong>
              <span>Space left</span>
            </div>
            <div className="sidebar-stat sidebar-stat-full">
              <strong>{formatBytes(storageStats?.totalBytes ?? 0)}</strong>
              <span>Disk total</span>
            </div>
          </div>
        </div>
      }
      actions={
        <div className="upload-actions">
          <label className="primary-button upload-button">
            <Icon name="upload" />
            <span>Add files</span>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleLocalUpload} />
          </label>
          <label className="ghost-button upload-button">
            <span>Add folder</span>
            <input ref={folderInputRef} type="file" multiple hidden onChange={handleLocalUpload} />
          </label>
        </div>
      }
    >
      <div
        className={dropActive ? "surface bulk-dropzone bulk-dropzone-active" : "surface bulk-dropzone"}
        onDragEnter={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) {
            setDropActive(false);
          }
        }}
        onDrop={handleDrop}
      >
        <div className="bulk-dropzone-copy">
          <span className="eyebrow">Bulk upload</span>
          <h2>Drop a batch of photos or videos here</h2>
          <p>Drag files, drop a whole folder, or use the upload buttons to import a large set into DRFT.</p>
        </div>
        <div className="bulk-dropzone-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose files
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => folderInputRef.current?.click()}
          >
            Choose folder
          </button>
        </div>
      </div>

      {loading ? (
        <div className="surface empty-state">
          <h2>Loading your library</h2>
          <p>Fetching the current timeline from DRFT.</p>
        </div>
      ) : null}

      {error ? (
        <div className="surface empty-state">
          <h2>Could not load files</h2>
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && !error
        ? orderedGroups.map(([dateKey, group]) => (
            <section key={dateKey} className="timeline-group">
              <div className="timeline-header">
                <h2>{formatDateLabel(dateKey)}</h2>
                <span>{group.length} items</span>
              </div>
              <MediaGrid items={group} onSelect={setSelectedItem} />
            </section>
          ))
        : null}

      {!loading && !error ? <div ref={loadMoreRef} style={{ height: 1 }} /> : null}
      {loadingMore ? (
        <div className="surface empty-state">
          <h2>Loading more media</h2>
          <p>Pulling the next part of your timeline from DRFT.</p>
        </div>
      ) : null}

      {!loading && !error && orderedGroups.length === 0 ? (
        <div className="surface empty-state">
          <h2>No media yet</h2>
          <p>Upload your first batch to start the timeline.</p>
        </div>
      ) : null}

      <MediaViewer
        item={selectedItem}
        onClose={() => {
          setSelectedItem(null);
          setViewerPanel("none");
          setConfirmDeleteItem(null);
        }}
        onDelete={handleDeleteFile}
        pendingDelete={confirmDeleteItem ? "confirm" : viewerPanel}
        onToggleInfo={() =>
          setViewerPanel((currentValue) =>
            currentValue === "info" ? "none" : "info"
          )
        }
      />

      {confirmDeleteItem ? (
        <div className="confirm-backdrop" onClick={() => setConfirmDeleteItem(null)}>
          <div className="confirm-dialog surface" onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">Delete media</span>
            <h2>Remove this file from DRFT?</h2>
            <p>
              This will remove the selected {confirmDeleteItem.mediaType} from both
              storage and the timeline.
            </p>
            <div className="confirm-actions">
              <button type="button" className="ghost-button" onClick={() => setConfirmDeleteItem(null)}>
                Cancel
              </button>
              <button type="button" className="ghost-button danger-button" onClick={confirmDelete}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
