import { useApp } from "../context/AppContext";
import ProtectedMedia from "./ProtectedMedia";

export default function MediaGrid({ items, onSelect }) {
  const { token } = useApp();

  return (
    <div className="media-masonry">
      {items.map((item, index) => (
        <button
          type="button"
          key={item.id}
          className="media-tile"
          style={{ animationDelay: `${index * 45}ms` }}
          onClick={() => onSelect(item)}
        >
          {item.mediaType === "video" ? (
            <ProtectedMedia
              token={token}
              src={item.downloadUrl || item.previewUrl}
              mediaType="video"
              className="media-video-preview"
              autoPlay
              muted
              previewDurationMs={4000}
            />
          ) : (
            <ProtectedMedia
              token={token}
              src={item.previewUrl}
              alt={item.fileName}
            />
          )}
          {item.mediaType === "video" ? (
            <div className="media-tile-badge">Video</div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
