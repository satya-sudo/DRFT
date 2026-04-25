import { useEffect, useRef, useState } from "react";

function isObjectURL(value) {
  return typeof value === "string" && value.startsWith("blob:");
}

function isDataURL(value) {
  return typeof value === "string" && value.startsWith("data:");
}

export function buildProtectedMediaURL(src, token) {
  if (!src || isObjectURL(src) || isDataURL(src)) {
    return src || "";
  }

  try {
    const url = new URL(src, window.location.origin);
    if (token && !url.searchParams.has("access_token")) {
      url.searchParams.set("access_token", token);
    }
    return url.toString();
  } catch {
    return src;
  }
}

export default function ProtectedMedia({
  token,
  src,
  alt,
  className,
  mediaType = "image",
  controls = false,
  autoPlay = false,
  muted = false,
  loop = false,
  previewDurationMs = 0
}) {
  const videoRef = useRef(null);
  const resolvedSrc = buildProtectedMediaURL(src, token);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src, token]);

  useEffect(() => {
    if (mediaType !== "video" || !autoPlay || previewDurationMs <= 0 || !resolvedSrc) {
      return undefined;
    }

    const handle = window.setTimeout(() => {
      if (!videoRef.current) {
        return;
      }

      videoRef.current.pause();
    }, previewDurationMs);

    return () => {
      window.clearTimeout(handle);
    };
  }, [autoPlay, mediaType, previewDurationMs, resolvedSrc]);

  if (failed || !resolvedSrc) {
    return <div className={`${className} media-fallback`}>Preview unavailable</div>;
  }

  if (mediaType === "video") {
    return (
      <video
        ref={videoRef}
        className={className}
        src={resolvedSrc}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop && previewDurationMs <= 0}
        preload={autoPlay ? "metadata" : "auto"}
        playsInline
        onError={() => setFailed(true)}
      />
    );
  }

  return <img className={className} src={resolvedSrc} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}
