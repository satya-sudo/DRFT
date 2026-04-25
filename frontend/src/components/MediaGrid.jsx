import { useApp } from "../context/AppContext";
import ProtectedMedia from "./ProtectedMedia";
import { Icon } from "./Icons";

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
            <div className="media-video-poster">
              <Icon name="video" />
              <span>Video</span>
            </div>
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
