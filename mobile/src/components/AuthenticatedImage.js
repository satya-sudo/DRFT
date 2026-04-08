import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { buildAuthenticatedMediaURL } from "../lib/config";

export default function AuthenticatedImage({
  downloadPath,
  previewPath,
  resizeMode = "cover",
  style,
  token
}) {
  const sources = useMemo(() => {
    const items = [];

    if (previewPath) {
      items.push({
        uri: buildAuthenticatedMediaURL(previewPath, token)
      });
    }

    if (downloadPath) {
      items.push({
        uri: buildAuthenticatedMediaURL(downloadPath, token)
      });
    }

    return items;
  }, [downloadPath, previewPath, token]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setLoading(true);
    setFailed(false);
  }, [downloadPath, previewPath, token]);

  const source = sources[sourceIndex];

  if (!source) {
    return <View style={[styles.fallback, style]} />;
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={source}
        resizeMode={resizeMode}
        style={styles.image}
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onError={() => {
          if (sourceIndex < sources.length - 1) {
            setSourceIndex((current) => current + 1);
            return;
          }

          setLoading(false);
          setFailed(true);
        }}
      />

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#8ab4f8" />
        </View>
      ) : null}

      {failed ? <View style={styles.fallback} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#232427"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 24, 24, 0.18)"
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#232427"
  }
});
