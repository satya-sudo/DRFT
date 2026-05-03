import { StyleSheet, Text, View } from "react-native";
import AuthenticatedImage from "./AuthenticatedImage";

export default function VideoPreviewTile({ item, token }) {
  const hasPreview = Boolean(item?.previewUrl);

  return (
    <View style={styles.container}>
      {hasPreview ? (
        <AuthenticatedImage
          previewPath={item.previewUrl}
          style={styles.previewImage}
          token={token}
        />
      ) : (
        <View style={styles.fallbackBackground} />
      )}

      <View style={styles.overlay}>
        <View style={styles.playBadge}>
          <Text style={styles.playBadgeText}>▶</Text>
        </View>
        {!hasPreview ? (
          <>
            <Text style={styles.title}>Video</Text>
            <Text style={styles.subtitle}>Open to play in viewer</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#232427",
    overflow: "hidden"
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject
  },
  fallbackBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#232427"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(16, 17, 20, 0.16)"
  },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#344055",
    alignItems: "center",
    justifyContent: "center"
  },
  playBadgeText: {
    color: "#f1f3f4",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 2
  },
  title: {
    color: "#f1f3f4",
    fontSize: 16,
    fontWeight: "700"
  },
  subtitle: {
    color: "#aeb4bb",
    fontSize: 13,
    fontWeight: "500"
  }
});
