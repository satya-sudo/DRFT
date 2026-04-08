import { StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { buildAuthenticatedMediaURL } from "../lib/config";

export default function VideoPreviewTile({ item, token }) {
  const source = {
    uri: buildAuthenticatedMediaURL(item.downloadUrl || item.previewUrl, token)
  };

  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.muted = true;
    videoPlayer.loop = true;
    videoPlayer.play();
  });

  return (
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} contentFit="cover" />
      <View style={styles.overlay} />
      <Text style={styles.badge}>Video</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#232427",
    justifyContent: "flex-end"
  },
  video: {
    width: "100%",
    height: "100%"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 11, 18, 0.18)"
  },
  badge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(17, 19, 24, 0.82)",
    color: "#f1f3f4",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "700"
  }
});
