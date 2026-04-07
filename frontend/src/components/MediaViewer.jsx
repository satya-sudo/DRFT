import { useApp } from "../context/AppContext";
import { Icon } from "./Icons";
import ProtectedMedia from "./ProtectedMedia";

function formatBytes(sizeBytes) {
  if (!sizeBytes) {
    return "0 MB";
  }

  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / (1024 * 1024)))} MB`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function MediaViewer({
  item,
  onClose,
  onDelete,
  pendingDelete,
  onToggleInfo
}) {
  const { token } = useApp();

  if (!item) {
    return null;
  }

  const mediaSource = item.downloadUrl || item.previewUrl;

  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div
        className="viewer-panel surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="viewer-toolbar">
          <button type="button" className="close-button" onClick={onClose}>
            Close
          </button>
          <div className="viewer-toolbar-actions">
            {!item.localOnly ? (
              <a className="ghost-button" href={mediaSource} download target="_blank" rel="noreferrer">
                <Icon name="download" />
                <span>Download</span>
              </a>
            ) : null}
            <button type="button" className="ghost-button" onClick={() => onToggleInfo?.()}>
              <Icon name="info" />
              <span>{pendingDelete === "info" ? "Hide info" : "More info"}</span>
            </button>
            {!item.localOnly ? (
              <button type="button" className="ghost-button danger-button" onClick={() => onDelete?.(item)}>
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div className="viewer-stage">
          {item.mediaType === "video" ? (
            <ProtectedMedia
              token={token}
              src={mediaSource}
              mediaType="video"
              controls
            />
          ) : (
            <ProtectedMedia
              token={token}
              src={mediaSource}
              alt={item.fileName}
            />
          )}
        </div>

        {pendingDelete === "info" ? (
          <div className="viewer-meta viewer-meta-panel">
            <div className="viewer-meta-row">
              <span>Name</span>
              <strong>{item.fileName}</strong>
            </div>
            <div className="viewer-meta-row">
              <span>Type</span>
              <strong>{item.mediaType}</strong>
            </div>
            <div className="viewer-meta-row">
              <span>Size</span>
              <strong>{formatBytes(item.sizeBytes)}</strong>
            </div>
            <div className="viewer-meta-row">
              <span>Taken</span>
              <strong>{formatDate(item.takenAt)}</strong>
            </div>
            {item.widthPx && item.heightPx ? (
              <div className="viewer-meta-row">
                <span>Dimensions</span>
                <strong>
                  {item.widthPx} × {item.heightPx}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
