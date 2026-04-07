import { useEffect, useRef, useState } from "react";

function isObjectURL(value) {
  return typeof value === "string" && value.startsWith("blob:");
}

function isDataURL(value) {
  return typeof value === "string" && value.startsWith("data:");
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
  const [resolvedSrc, setResolvedSrc] = useState(
    isObjectURL(src) || isDataURL(src) ? src : ""
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc("");
      return;
    }

    if (isObjectURL(src) || isDataURL(src)) {
      setResolvedSrc(src);
      setFailed(false);
      return;
    }

    let revokedURL = "";
    let cancelled = false;

    async function loadProtectedMedia() {
      try {
        setFailed(false);

        const response = await fetch(src, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("media fetch failed");
        }

        const blob = await response.blob();
        revokedURL = URL.createObjectURL(blob);

        if (!cancelled) {
          setResolvedSrc(revokedURL);
        }
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    loadProtectedMedia();

    return () => {
      cancelled = true;
      if (revokedURL) {
        URL.revokeObjectURL(revokedURL);
      }
    };
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
      />
    );
  }

  return <img className={className} src={resolvedSrc} alt={alt} />;
}
